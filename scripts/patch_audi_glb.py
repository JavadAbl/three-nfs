#!/usr/bin/env python3
"""Patch 2010_audi_tt_rs.glb for the game's auto-detection pipeline:
- rename 4 wheel-assembly groups -> wheel_FL/FR/RL/RR (raw coords; loader
  auto-flips so FR ends up at +z — front is raw -z, confirmed by overhang/
  glass-gap calibration against the known-good old TT model)
- rename 4 brake-disk mesh nodes -> brakedisc_<corner> ("disc" spelling
  matches the loader's /brake|disc|cap|caliper/ attach test)
- rename body paint material TTRS -> TTRS_paint (matches /_paint$/ tint rule)
Keeps BIN chunk byte-identical; only node/material names change.
"""
import json, struct, sys

SRC = "/home/z/my-project/upload/2010_audi_tt_rs.glb"
DST = "/home/z/my-project/public/models/audi-tt-rs-2010.glb"

def read_glb(path):
    with open(path, "rb") as f:
        magic, ver, total = struct.unpack("<4sII", f.read(12))
        assert magic == b"glTF", "not a GLB"
        chunks = []
        while True:
            hdr = f.read(8)
            if len(hdr) < 8: break
            clen, ctype = struct.unpack("<II", hdr)
            data = f.read(clen)
            if clen % 4: f.read(4 - (clen % 4))
            chunks.append((ctype, data))
    return ver, chunks

ver, chunks = read_glb(SRC)
js = json.loads(next(c for t, c in chunks if t == struct.unpack("<I", b"JSON")[0]).decode("utf-8"))

nodes = js["nodes"]
mats = js["materials"]

# raw coords: front = -z (overhang 0.655 vs 0.561), +x side = "L" (loader convention)
RENAME_NODES = {
    "Group14": "wheel_FR",   # x=-0.78, z=-1.184 -> raw front, x<0
    "Group17": "wheel_RR",   # x=-0.79, z=+1.276 -> raw rear, x<0
    "Group20": "wheel_FL",   # x=+0.78, z=-1.184 -> raw front, x>=0
    "Group23": "wheel_RL",   # x=+0.79, z=+1.276 -> raw rear, x>=0
    "Mesh22_disk_0": "brakedisc_FL",  # x=+0.795, z=-1.19
    "Mesh23_disk_0": "brakedisc_FR",  # x=-0.795, z=-1.19
    "Mesh24_disk_0": "brakedisc_RL",  # x=+0.805, z=+1.27
    "Mesh25_disk_0": "brakedisc_RR",  # x=-0.805, z=+1.27
}
RENAME_MATS = {"TTRS": "TTRS_paint"}

n_renamed = 0
for n in nodes:
    if n.get("name") in RENAME_NODES:
        n["name"] = RENAME_NODES[n["name"]]
        n_renamed += 1
m_renamed = 0
for m in mats:
    if m.get("name") in RENAME_MATS:
        m["name"] = RENAME_MATS[m["name"]]
        m_renamed += 1

assert n_renamed == 8, f"expected 8 node renames, got {n_renamed}"
assert m_renamed == 1, f"expected 1 material rename, got {m_renamed}"

# ── re-serialize ──
js_bytes = json.dumps(js, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
pad = (4 - len(js_bytes) % 4) % 4
js_bytes += b" " * pad

bin_chunk = next((c for t, c in chunks if t == struct.unpack("<I", b"BIN\x00")[0]), b"")
bin_pad = (4 - len(bin_chunk) % 4) % 4
bin_out = bin_chunk + b"\x00" * bin_pad

total = 12 + 8 + len(js_bytes) + 8 + len(bin_out)
with open(DST, "wb") as f:
    f.write(struct.pack("<4sII", b"glTF", 2, total))
    f.write(struct.pack("<II", len(js_bytes), struct.unpack("<I", b"JSON")[0]))
    f.write(js_bytes)
    f.write(struct.pack("<II", len(bin_out), struct.unpack("<I", b"BIN\x00")[0]))
    f.write(bin_out)

print(f"patched -> {DST} ({total/1e6:.2f} MB): {n_renamed} nodes, {m_renamed} material renamed")
