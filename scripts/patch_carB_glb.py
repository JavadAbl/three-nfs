#!/usr/bin/env python3
"""Patch upload/car_B (Renault 5 GT Turbo) for the auto-detection pipeline
(CarModelLoader.ts). JSON-ONLY edits — BIN chunk stays byte-identical
(audi precedent, scripts/patch_audi_glb.py).

Edits & why (verified against upload/car_B_scan.txt + loader source):
1. NODE renames: the 6 wheel meshes carry generic Sketchfab "Object_NN"
   names and NO material name matches WHEEL_MAT — the loader would find
   zero wheel anchors and fall back to 4 fake pivots. The meshes are
   merged L+R axle pairs (x-extent 2.19-2.33 > PAIR_WIDTH 1.15), which
   the loader's addPiece splits at the centreline and corners by position:
     front axle z+2.06: Object_51 (Jante rims) + Object_149/150 (Noir tires)
     rear  axle z-1.99: Object_60 (Jante rims) + Object_62/63  (Noir tires)
   Mesh names are renamed too for inspector readability.
2. MATERIAL "Caros" -> "Caros_paint" — the /_paint$/ tint rule; 6 body
   panels (hood, fenders, shell, hatch) become garage-recolorable.
   "renault-5" (livery decal), "Vitre" (glass), "Jante" (rims) stay.
3. NEW MATERIAL "feux_stop" (deepcopy of "Stop") + re-point ONLY the two
   REAR Stop meshes (nodes Object_74 @ z-2.71, Object_217 @ z-2.83) at it.
   LAMP_MAT knows "feux"; both meshes sit at z<0 so splitDarkLamps lights
   them stop-red. The THIRD "Stop" mesh (Object_106, dashboard, z+0.82)
   keeps the original material -> stays dark.
   "Phare-avt" (headlights, z+2.63..2.80) already matches LAMP_MAT via
   the "phare" token — untouched. "Veil"/"Cligno" stay dark by choice.
"""
import json, struct, copy

SRC = "/home/z/my-project/upload/car_B"
DST = "/home/z/my-project/upload/car_B_patched.glb"

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
meshes = js["meshes"]
mats = js["materials"]

def node_idx(name):
    hits = [i for i, n in enumerate(nodes) if n.get("name") == name]
    return hits

# ── 1. wheel node + mesh renames ──
RENAME_NODES = {
    "Object_51":  "wheel_ft_rim",     # Jante rims,  front pair, z +2.06
    "Object_149": "wheel_ft_tire_a",  # Noir tire,   front pair, z +2.06
    "Object_150": "wheel_ft_tire_b",  # Noir tire,   front pair, z +2.06
    "Object_60":  "wheel_bk_rim",     # Jante rims,  rear pair,  z -1.99
    "Object_62":  "wheel_bk_tire_a",  # Noir tire,   rear pair,  z -1.99
    "Object_63":  "wheel_bk_tire_b",  # Noir tire,   rear pair,  z -1.99
}
n_renamed = 0
for old, new in RENAME_NODES.items():
    hits = node_idx(old)
    assert len(hits) == 1, f"node '{old}': expected 1, got {len(hits)}"
    n = nodes[hits[0]]
    n["name"] = new
    if "mesh" in n:
        m_idx = n["mesh"]
        assert isinstance(m_idx, int) and 0 <= m_idx < len(meshes), f"mesh ref broken for {old}"
        meshes[m_idx]["name"] = new
    n_renamed += 1
    print(f"node+mesh {old!r} -> {new!r}")

# ── 2. paint material rename ──
PAINT_OLD, PAINT_NEW = "Caros", "Caros_paint"
hit = [m for m in mats if m.get("name") == PAINT_OLD]
assert len(hit) == 1, f"material '{PAINT_OLD}': expected 1, got {len(hit)}"
hit[0]["name"] = PAINT_NEW
print(f"mat   {PAINT_OLD!r} -> {PAINT_NEW!r}")

# ── 3. rear-lamp material split ──
stop_idx = [i for i, m in enumerate(mats) if m.get("name") == "Stop"]
assert len(stop_idx) == 1, f"material 'Stop': expected 1, got {len(stop_idx)}"
stop = mats[stop_idx[0]]
feux = copy.deepcopy(stop)
feux["name"] = "feux_stop"
# property-distinct from the interior's "Stop": gltf-transform dedup merges
# byte-identical materials (names excluded), which silently re-merged the
# pair on the first optimization pass. 0.001 red is invisible pre-lighting
# and splitDarkLamps overwrites emissiveIntensity anyway.
feux["emissiveFactor"] = [0.001, 0.0, 0.0]
mats.append(feux)
feux_idx = len(mats) - 1
print(f"mat   new 'feux_stop' (copy of Stop, index {feux_idx})")

REAR_STOP_NODES = ["Object_74", "Object_217"]  # z -2.71 / -2.83 (rear panel)
INTERIOR_STOP_NODE = "Object_106"              # dashboard z +0.82 — must stay dark

# nodes referencing each mesh (a mesh shared by several nodes must not be
# mutated blindly — duplicate it per node in that case)
mesh_refs = {}
for i, n in enumerate(nodes):
    if "mesh" in n:
        mesh_refs.setdefault(n["mesh"], []).append(i)

repointed = 0
for name in REAR_STOP_NODES:
    hits = node_idx(name)
    assert len(hits) == 1, f"rear lamp node '{name}': expected 1, got {len(hits)}"
    n = nodes[hits[0]]
    m_idx = n["mesh"]
    refs = mesh_refs[m_idx]
    if len(refs) > 1:
        # shared mesh: clone it so the interior/other user keeps "Stop"
        clone = copy.deepcopy(meshes[m_idx])
        meshes.append(clone)
        m_idx = len(meshes) - 1
        n["mesh"] = m_idx
        print(f"      mesh {n['mesh']} shared by {len(refs)} nodes — cloned to index {m_idx}")
    for prim in meshes[m_idx]["primitives"]:
        assert prim.get("material") == stop_idx[0], \
            f"{name}: primitive material {prim.get('material')} is not 'Stop' ({stop_idx[0]})"
        prim["material"] = feux_idx
    repointed += 1
    print(f"repointed {name!r} primitives -> feux_stop")

# sanity: interior node still on original Stop material
interior = node_idx(INTERIOR_STOP_NODE)
assert len(interior) == 1, f"interior node '{INTERIOR_STOP_NODE}': expected 1, got {len(interior)}"
im_idx = nodes[interior[0]]["mesh"]
for prim in meshes[im_idx]["primitives"]:
    assert prim.get("material") == stop_idx[0], \
        f"interior {INTERIOR_STOP_NODE} no longer on 'Stop' — aborting"
print(f"ok    interior {INTERIOR_STOP_NODE!r} stays on 'Stop' (dark)")

# ── 4. delete the floating display-stand cluster above the roof ──
# Sketchfab showcase leftover: a thin Noir pole (Object_141), a Chrome rod
# (Object_145) and a small Noir cube (Object_143) hover ~0.8 m above the
# roof at mid-car (raw y 2.17..2.79 vs roof 2.00). They drag template
# topY 2.94 (roof alone = 2.00), which lifts the hood camera ~0.7 m too
# high — and sweepJunk cannot see them (its maxY is derived from a bbox
# that already includes them).
DELETE_NODES = ["Cylindre_63", "Cube_64", "Cylindre.001_65"]

def parent_of(target):
    for n in nodes:
        for ci, child in enumerate(n.get("children", [])):
            if child == target:
                return n, ci
    return None, None

stand_removed = 0
for name in DELETE_NODES:
    hits = node_idx(name)
    assert len(hits) == 1, f"stand node '{name}': expected 1, got {len(hits)}"
    p, ci = parent_of(hits[0])
    assert p is not None, f"stand node '{name}' has no parent reference"
    del p["children"][ci]
    stand_removed += 1
    print(f"del   node {name!r} (stand cluster, orphaned)")

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

print(f"\npatched -> {DST} ({total/1e6:.2f} MB)")
print(f"summary: {n_renamed} wheel renames, 1 paint rename, {repointed} rear lamps repointed")
