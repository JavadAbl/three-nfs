#!/usr/bin/env python3
r"""Phase 1a of the Corvette integration (2026-10-31 plan).

Two new Sketchfab rips in upload/:
  chevrolet_corvette_c7.glb       (C7 Stingray-ish, per-corner wheel rigs)
  2010_chevrolet_corvette_c6.r.glb (C6.R-style race livery, merged wheel layers)

This script applies the JSON material renames the auto-rig pipeline needs
(verified against upload/c7_scan.txt / upload/c6_scan.txt + CarModelLoader.ts)
and puts every embedded texture on a diet (<=1024px, PNG -> WebP q88/q93 for
normals).  Run AFTER `gltf-transform dedup` (renames assert on the deduped
file), and BEFORE `gltf-transform draco`.

Renames & why:
  C7  Car_Paint_2     -> carpaint_rear
      Loader paint rule is /carpaint/i OR (^|_)paint$ — the trailing "_2"
      broke both, so the rear fascia piece would never recolor in the garage.
  C7  Daylight_Cover  -> Daylight_Lamp_Cover
      LAMP_MAT token "light" needs a non-letter boundary BEFORE it; "Daylight"
      fails the lookbehind so the DRL strip would stay dead at night.
      "Lamp" standalone matches -> lit warm-white (mesh centroid z>0 = front).
  C6  emissivenumber.008 -> race_number
      "emiss" matches LAMP_MAT's emiss\w* — the door race numbers would be
      taken over as lamps and glow TAIL RED at night (centroid z≈-0.08 →
      classified rear). Kill the keyword, keep the look via its own texture.
  C6  body.011        -> body_carpaint
      No paint-regex match at all → garage tint would silently do nothing.
      /carpaint/i now matches; applyPaint tints textured paints toward the
      chosen colour, so the race livery texture survives a recolor.

Texture diet:
  - decode every image bufferView, dedup by content hash
  - downscale to <=1024px (LANCZOS)
  - re-encode WebP (q93 for normal maps, q88 otherwise)
  - keep originals untouched when already small AND <=1024px
BIN chunk is fully rebuilt (images move; geometry slices are copied
byte-identically). buffer.byteLength is updated.

Usage: python3 scripts/patch_corvette_glbs.py <in.glb> <out.glb> <c7|c6>
"""
import hashlib
import io
import json
import struct
import sys

from PIL import Image

MAX_DIM = 1024
WEBP_Q = 88
WEBP_Q_NORMAL = 93

RENAME_C7 = {
    "Car_Paint_2": "carpaint_rear",
    "Daylight_Cover": "Daylight_Lamp_Cover",
}
RENAME_C6 = {
    "emissivenumber.008": "race_number",
    "body.011": "body_carpaint",
}


def read_glb(path):
    with open(path, "rb") as f:
        magic, ver, total = struct.unpack("<4sII", f.read(12))
        assert magic == b"glTF", "not a GLB"
        chunks = []
        while True:
            hdr = f.read(8)
            if len(hdr) < 8:
                break
            clen, ctype = struct.unpack("<II", hdr)
            data = f.read(clen)
            if clen % 4:
                f.read(4 - clen % 4)
            chunks.append((ctype, data))
    js = json.loads(next(c for t, c in chunks if t == struct.unpack("<I", b"JSON")[0]).decode("utf-8"))
    bin_chunk = next((c for t, c in chunks if t == struct.unpack("<I", b"BIN\x00")[0]), b"")
    return js, bin_chunk


def write_glb(path, js, bin_chunk):
    js_bytes = json.dumps(js, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
    js_bytes += b" " * ((4 - len(js_bytes) % 4) % 4)
    bin_out = bin_chunk + b"\x00" * ((4 - len(bin_chunk) % 4) % 4)
    total = 12 + 8 + len(js_bytes) + 8 + len(bin_out)
    with open(path, "wb") as f:
        f.write(struct.pack("<4sII", b"glTF", 2, total))
        f.write(struct.pack("<II", len(js_bytes), struct.unpack("<I", b"JSON")[0]))
        f.write(js_bytes)
        f.write(struct.pack("<II", len(bin_out), struct.unpack("<I", b"BIN\x00")[0]))
        f.write(bin_out)
    return total


def main():
    src, dst, which = sys.argv[1], sys.argv[2], sys.argv[3]
    renames = RENAME_C7 if which == "c7" else RENAME_C6
    js, bin_chunk = read_glb(src)

    # ── 1. material renames (assert every target exists exactly once) ──
    mats = js.get("materials", [])
    hits = 0
    for m in mats:
        old = m.get("name")
        if old in renames:
            m["name"] = renames[old]
            print(f"mat   {old!r} -> {m['name']!r}")
            hits += 1
    assert hits == len(renames), f"expected {len(renames)} renames, matched {hits}"

    # ── 2. which images feed normal maps (higher WebP quality) ──
    normal_imgs = set()
    for m in mats:
        nt = m.get("normalTexture")
        if isinstance(nt, dict):
            tex = js["textures"][nt.get("index", 0)]
            if "source" in tex:
                normal_imgs.add(tex["source"])

    images = js.get("images", [])
    bvs = js.get("bufferViews", [])

    # image index -> its bufferView index (skip uri-based images)
    img_bv = {}
    for i, im in enumerate(images):
        if "bufferView" in im:
            img_bv[i] = im["bufferView"]
    bv_is_image = set(img_bv.values())

    # ── 3. rebuild the BIN: geometry slices copied, images re-encoded ──
    out = io.BytesIO()

    def append(data):
        off = out.tell()
        out.write(data)
        pad = (4 - len(data) % 4) % 4
        if pad:
            out.write(b"\x00" * pad)
        return off, len(data)

    # process each image once; dedup by content hash of the ORIGINAL bytes
    new_bv_bytes = {}   # bv index -> (offset, length) in new bin
    hash_to_bv = {}     # original-bytes hash -> bv index (post-processing)
    stats = {"resized": 0, "reencoded": 0, "kept": 0, "deduped": 0}
    img_orig_bytes = {}

    for i, im in enumerate(images):
        if i not in img_bv:
            continue
        bvi = img_bv[i]
        bv = bvs[bvi]
        raw = bin_chunk[bv.get("byteOffset", 0): bv.get("byteOffset", 0) + bv.get("byteLength", 0)]
        img_orig_bytes[i] = raw
        h = hashlib.sha256(raw).hexdigest()
        if h in hash_to_bv:
            im["bufferView"] = hash_to_bv[h]
            stats["deduped"] += 1
            continue

        keep = raw
        mime = im.get("mimeType", "image/png")
        resized = False
        try:
            img = Image.open(io.BytesIO(raw))
            img.load()
            w, hgt = img.size
            if max(w, hgt) > MAX_DIM:
                scale = MAX_DIM / max(w, hgt)
                img = img.resize((max(1, round(w * scale)), max(1, round(hgt * scale))), Image.LANCZOS)
                resized = True
            if img.mode not in ("RGB", "RGBA"):
                img = img.convert("RGBA" if "A" in img.mode or "transparency" in img.info else "RGB")
            # re-encode EVERYTHING to WebP (guards below: only adopt when
            # smaller, or when a resize already happened)
            q = WEBP_Q_NORMAL if i in normal_imgs else WEBP_Q
            enc = io.BytesIO()
            img.save(enc, format="WEBP", quality=q, method=6)
            if len(enc.getvalue()) < len(raw) or resized:
                keep = enc.getvalue()
                mime = "image/webp"
        except Exception as e:  # noqa: BLE001 — a bad image must not kill the patch
            print(f"  ! image {i} ({im.get('name', '?')}): {e}; keeping original bytes")

        off, length = append(keep)
        new_bv_bytes[bvi] = (off, length)
        im["mimeType"] = mime
        hash_to_bv[h] = bvi
        if resized:
            stats["resized"] += 1
        if mime == "image/webp" and keep is not raw:
            stats["reencoded"] += 1
        else:
            stats["kept"] += 1

    # copy non-image bufferViews in original order, then images already placed
    # — simpler: iterate bvs in order; image bvs already have placements.
    for bvi, bv in enumerate(bvs):
        if bvi in bv_is_image:
            if bvi in new_bv_bytes:
                off, length = new_bv_bytes[bvi]
                bv["byteOffset"], bv["byteLength"] = off, length
            continue
        raw = bin_chunk[bv.get("byteOffset", 0): bv.get("byteOffset", 0) + bv.get("byteLength", 0)]
        off, length = append(raw)
        bv["byteOffset"], bv["byteLength"] = off, length

    # NOTE: image blobs were appended BEFORE geometry here; offsets recorded
    # above are absolute in the final buffer, so ordering does not matter.

    new_bin = out.getvalue()
    js["buffers"][0]["byteLength"] = len(new_bin)
    total = write_glb(dst, js, new_bin)

    print(
        f"textures: {stats['resized']} resized, {stats['reencoded']} -> webp, "
        f"{stats['kept']} kept, {stats['deduped']} deduped"
    )
    print(f"patched -> {dst} ({total / 1e6:.2f} MB from {len(open(src,'rb').read())/1e6:.2f} MB)")


if __name__ == "__main__":
    main()
