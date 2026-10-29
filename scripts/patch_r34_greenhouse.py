#!/usr/bin/env python3
"""patch_r34_greenhouse.py — the pg206's windows stop following the garage
paint selection; glass goes see-through like the R5's.

JSON-ONLY edits, BIN chunk byte-identical (patch_r34_glass.py precedent).

Why (user report 2026-10-30: "pg206 glasses colors are sync with selection
color. make them transparent like renp5"):
the GTA "Elegy" rip (a Peugeot-206-shaped body — hence the model's
emzone_206_* materials) ships a GREENHOUSE LINER behind the window shell:

  node[39] body.001_remapelegybod1_0  (mesh 10, 278 tris)
    bbox ~ x ±0.60  y 0.73..1.13  z -1.36..0.81   (raw glTF space)
    = the side-window band, 9-15 cm INBOARD of the juoda_glass shell,
      ALL 278 tris outward-facing, half of them within 22 cm of a glass
      triangle — a window-shaped panel looking straight at every pane.

It wears `remapelegybod1_paint`, which the loader classifies as BODY PAINT
(ends in `_paint`). So the see-through tinted windows (juoda_glass, 0.36
opacity) show THIS liner — and the liner takes whatever colour the player
picked in the garage: green car = green "glass", pink car = pink "glass".

Fix: splice the liner node from the scene graph (same surgery ce72815
performed on the inner plasmase shell — GTA rips stack inner shells; this
one is paint-mapped). Behind it sits the real cabin (emzone_206_salo1,
6344 tris of seats/door cards/headliner) — so the windows now read like the
Renault 5's: dark see-through tint over a visible interior. The material
entry stays (orphaned, unworn — paintNames is built from worn materials,
so it can never tint again).

Second edit — CABIN VISIBILITY: this GTA rip ships ZERO textures (all
materials are flat baseColorFactor), and the cabin (emzone_206_salo1) is
baked [0,0,0,1] — a pitch-black void that reads exactly like the old opaque
blackout even through 0.36-opacity glass. The R5's interior reads through
its tint because ITS materials carry seat/dash textures. Lift salo to a
dark interior gray so seat/dash/headliner silhouettes show through the
tint, matching the R5's see-through look.

Idempotent: safe to re-run (liner splice skipped if already gone).
"""
import json, struct, sys

SRC = "/home/z/my-project/public/models/skyline-gtr-r34.glb"
TARGET_NODE = "body.001_remapelegybod1_0"
TARGET_MAT = "remapelegybod1_paint"


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
                f.read(4 - (clen % 4))
            chunks.append((ctype, data))
    return chunks


def write_glb(path, chunks, js):
    js_bytes = json.dumps(js, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
    pad = (4 - len(js_bytes) % 4) % 4
    js_bytes += b" " * pad
    bin_chunk = next((c for t, c in chunks if t == struct.unpack("<I", b"BIN\x00")[0]), b"")
    bin_pad = (4 - len(bin_chunk) % 4) % 4
    bin_out = bin_chunk + b"\x00" * bin_pad
    total = 12 + 8 + len(js_bytes) + 8 + len(bin_out)
    with open(path, "wb") as f:
        f.write(struct.pack("<4sII", b"glTF", 2, total))
        f.write(struct.pack("<II", len(js_bytes), struct.unpack("<I", b"JSON")[0]))
        f.write(js_bytes)
        f.write(struct.pack("<II", len(bin_out), struct.unpack("<I", b"BIN\x00")[0]))
        f.write(bin_out)
    return total


if __name__ == "__main__":
    chunks = read_glb(SRC)
    js = json.loads(next(c for t, c in chunks if t == struct.unpack("<I", b"JSON")[0]).decode("utf-8"))
    nodes, meshes, mats = js["nodes"], js["meshes"], js["materials"]

    # ── 1. locate the liner node (skip splice if a previous run removed it) ──
    # (the orphan node STAYS in the JSON by convention — a previous run leaves
    # it parentless, which is how we detect "already spliced")
    liner = [i for i, n in enumerate(nodes) if n.get("name") == TARGET_NODE]
    already_spliced = bool(liner) and not any(
        liner[0] in n.get("children", []) for n in nodes
    )
    if already_spliced:
        print(f"liner node {liner[0]} already spliced (parentless orphan) — skipping")
        liner = []
    if not liner:
        print("liner already spliced by a previous run — skipping")
    else:
        assert len(liner) == 1, f"liner node: expected 1, got {len(liner)}"
        liner_idx = liner[0]

        # sanity: the node is the ONLY wearer of the paint material
        mat_idx = next((i for i, m in enumerate(mats) if m.get("name") == TARGET_MAT), None)
        assert mat_idx is not None, "paint material missing"
        wearers = [
            i
            for i, n in enumerate(nodes)
            if n.get("mesh") is not None
            and any(p.get("material") == mat_idx for p in meshes[n["mesh"]].get("primitives", []))
        ]
        assert wearers == [liner_idx], f"paint wearers {wearers} != [liner {liner_idx}] — splicing would orphan more than the liner"
        # no other node shares this mesh (instancing would delete a live mesh)
        sharers = [i for i, n in enumerate(nodes) if n.get("mesh") == nodes[liner_idx].get("mesh")]
        assert sharers == [liner_idx], f"liner mesh shared by nodes {sharers}"

        # splice the liner from its parent
        parents = [i for i, n in enumerate(nodes) if liner_idx in n.get("children", [])]
        assert len(parents) == 1, f"liner parent count {len(parents)}"
        nodes[parents[0]]["children"].remove(liner_idx)
        print(f"liner node {liner_idx} ({TARGET_NODE}) spliced from parent {parents[0]}")

    # ── 2. lift the cabin gray so the interior reads through the tint ──
    salo_idx = next((i for i, m in enumerate(mats) if m.get("name") == "emzone_206_salo1"), None)
    assert salo_idx is not None, "cabin material missing"
    SALO_GRAY = [0.23, 0.23, 0.25, 1.0]  # ~#3b3b40 — dark gray seats/panels, visible behind 0.36 tint
    mats[salo_idx]["pbrMetallicRoughness"]["baseColorFactor"] = SALO_GRAY
    print(f"cabin emzone_206_salo1 baseColorFactor -> {SALO_GRAY[:3]}")

    # ── 3. sanity: the cabin + window shell are intact ──
    salo = [i for i, n in enumerate(nodes) if "emzone_206_salo1_0" in (n.get("name") or "")]
    assert salo, "cabin interior (emzone_206_salo1) missing — windows would hollow"
    glass = [i for i, n in enumerate(nodes) if n.get("name") == "body.001_emzone_juoda1_0"]
    assert glass, "outer window shell missing"
    print(f"cabin meshes kept: {len(salo)} (emzone_206_salo1_0*)  shell kept: 1 (body.001_emzone_juoda1_0)")

    total = write_glb(SRC, chunks, js)
    print(f"\npatched -> {SRC} ({total/1e6:.2f} MB)")
