#!/usr/bin/env python3
"""Patch upload/car_A (GTA-SA "Elegy" = R34-style) for the auto-detection
pipeline (CarModelLoader.ts). JSON-ONLY edits — BIN chunk stays byte-identical
(audi precedent, scripts/patch_audi_glb.py).

Edits & why (verified against upload/car_A_scan.txt + loader source):
1. NODE "wheel.ft.r.002" -> "wheel.bk.r"
   Misnamed rear-left wheel (world pos -0.58,+0.26,-1.03 = rear). The loader
   corners by POSITION so it lands RR/RL correctly either way, but the
   /ft|bk/ forward-orientation probe averages named-wheel z — keeping "ft"
   on a rear wheel biases it. Correct semantic name = free fix.
2. DELETE nodes "Cube", "Cube.001", "Cube.003", "Cube.004" (splice from
   parent's children; entries orphaned for gltf-transform prune to clean).
   GTA-style wheel-proxy quads parked dead on each wheel hub (e.g. flat
   0.32x0.32 Material.012 disc at the FL hub) + tiny arch bits. rigWheels'
   loose-attach pass (size < 1.1, dist < 0.55 from corner centre) would
   sweep them into the SPINNING wheel pivots.
3. DELETE one of the two duplicate tire nodes under wheel.ft.r.001 /
   wheel.ft.r.002 (children named "<wheel>_Material.023_0" x2, nested full
   tires 0.23 vs 0.22 wide, same centre). Keep the wider (0.23) one.
   Saves ~100k verts of hidden geometry and z-fight risk.
4. NODE renames with "_sidelight" suffix: the 4 mirror-housing mesh nodes
   under body.002 / body.007 (diag 0.99 < 1.1 gate, ~0.45 < 0.55 from the
   front wheel hubs) — without this the mirrors would spin with the wheels.
   "light" makes the attach pass skip them (labels test). Semantics: mirror
   indicators ARE sidelights, so the name stays honest.
5. MATERIAL renames to match loader regexes (CarModelLoader.ts):
   - "vehiclelights2" -> "vehicle_lights2"   LAMP_MAT: token "lights" needs
     a non-letter boundary BEFORE it ("vehiclelights" fails the lookbehind).
     Mesh sits at z +1.49..+1.51 -> classified front -> warm-white head.
   - "emzone_206_deta1" -> "emzone_206_tail_lights"  ("tail_lights" token;
     meshes at z -1.43..-1.03 -> rear -> stop red). "deta" is Lithuanian GTA
     zone text, meaningless to the loader.
   - "remapelegybody1.001" -> "remapelegybody1.001_paint" (9 meshes, main
     body paint; /_paint$/ tint rule) — recolorable in the garage.
   - "remapelegybod1" -> "remapelegybod1_paint" (lower skirt paint).
   - "emzone_plasmase1" (GTA neon trim) deliberately NOT renamed.
"""
import json, struct, copy

SRC = "/home/z/my-project/upload/car_A"
DST = "/home/z/my-project/upload/car_A_patched.glb"

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

def node_idx(name):
    hits = [i for i, n in enumerate(nodes) if n.get("name") == name]
    return hits

RENAME_NODES = {"wheel.ft.r.002": "wheel.bk.r"}
MIRROR_NODES = [
    "body.002_emzone_juoda1_0",
    "body.002_remapelegybody1.001_0",
    "body.007_emzone_juoda1_0",
    "body.007_remapelegybody1.001_0",
]
DELETE_NODES = ["Cube", "Cube.001", "Cube.003", "Cube.004"]
RENAME_MATS = {
    "vehiclelights2": "vehicle_lights2",
    "emzone_206_deta1": "emzone_206_tail_lights",
    "remapelegybody1.001": "remapelegybody1.001_paint",
    "remapelegybod1": "remapelegybod1_paint",
}

# ── 1. plain node renames ──
for old, new in RENAME_NODES.items():
    hits = node_idx(old)
    assert len(hits) == 1, f"node '{old}': expected 1, got {len(hits)}"
    nodes[hits[0]]["name"] = new
    print(f"node  {old!r} -> {new!r}")

# ── 2. mirror dodge renames ──
for old in MIRROR_NODES:
    hits = node_idx(old)
    assert len(hits) == 1, f"mirror node '{old}': expected 1, got {len(hits)}"
    nodes[hits[0]]["name"] = old + "_sidelight"
    print(f"node  {old!r} -> {old + '_sidelight'!r}")

# ── 3. splice junk proxy assemblies out of their parents ──
def parent_of(target):
    for n in nodes:
        for ci, child in enumerate(n.get("children", [])):
            if child == target:
                return n, ci
    return None, None

deleted = 0
for name in DELETE_NODES:
    hits = node_idx(name)
    assert len(hits) == 1, f"junk node '{name}': expected 1, got {len(hits)}"
    p, ci = parent_of(hits[0])
    assert p is not None, f"junk node '{name}' has no parent reference"
    del p["children"][ci]
    deleted += 1
    print(f"del   node {name!r} (orphaned with {len(nodes[hits[0]].get('children', []))} children)")

# ── 4. duplicate nested tires under the two right-side wheels ──
def accessor_xspan(mesh_idx):
    """x-extent of a mesh's POSITION accessor via glTF accessor min/max."""
    mesh = js["meshes"][mesh_idx]
    spans = []
    for prim in mesh["primitives"]:
        acc = js["accessors"][prim["attributes"]["POSITION"]]
        if "min" in acc and "max" in acc:
            spans.append(acc["max"][0] - acc["min"][0])
    return max(spans) if spans else None

dup_removed = 0
for wheel_name, tire_name in [("wheel.bk.r", "wheel.ft.r.002_Material.023_0"),
                              ("wheel.ft.r.001", "wheel.ft.r.001_Material.023_0")]:
    hits = node_idx(wheel_name)
    assert len(hits) == 1, f"wheel '{wheel_name}': expected 1, got {len(hits)}"
    wheel = nodes[hits[0]]
    tire_nodes = [c for c in wheel.get("children", []) if nodes[c].get("name") == tire_name]
    print(f"dup   {wheel_name!r}: {len(tire_nodes)} tire child nodes named {tire_name!r}")
    if len(tire_nodes) == 2:
        m0, m1 = nodes[tire_nodes[0]].get("mesh"), nodes[tire_nodes[1]].get("mesh")
        s0, s1 = (accessor_xspan(m0) if m0 is not None else None,
                  accessor_xspan(m1) if m1 is not None else None)
        if m0 == m1:
            keep, drop = tire_nodes[1], tire_nodes[0]  # same mesh: keep last ref, drop first
            why = "same mesh index (instanced node)"
        else:
            if (s0 or 0) >= (s1 or 0):
                keep, drop = tire_nodes[0], tire_nodes[1]
            else:
                keep, drop = tire_nodes[1], tire_nodes[0]
            why = f"x-span {s0} vs {s1}"
        wheel["children"].remove(drop)
        dup_removed += 1
        print(f"      dropped node idx {drop} (kept {keep}) — {why}")
    else:
        print(f"      no dedupe needed")

# ── 5. material renames ──
m_renamed = 0
for m in mats:
    old = m.get("name")
    if old in RENAME_MATS:
        m["name"] = RENAME_MATS[old]
        m_renamed += 1
        print(f"mat   {old!r} -> {m['name']!r}")
assert m_renamed == len(RENAME_MATS), f"expected {len(RENAME_MATS)} material renames, got {m_renamed}"

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
print(f"summary: {len(RENAME_NODES)} wheel rename, {len(MIRROR_NODES)} mirror renames, "
      f"{deleted} junk assemblies, {dup_removed} duplicate tires, {m_renamed} materials")
