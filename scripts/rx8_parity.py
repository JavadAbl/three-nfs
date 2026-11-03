#!/usr/bin/env python3
"""rx8_parity.py — acceptance gate 3 (numeric parity) for the RX-8:
compare staging (raw) vs compressed GLB structure: node count, material
count, mesh count, per-mesh vertex/triangle totals, texture slots."""
import json, struct, sys

def load_glb_json(path):
    with open(path, "rb") as f:
        data = f.read()
    magic, ver, length = struct.unpack_from("<III", data, 0)
    assert magic == 0x46546C67, f"not a GLB: {path}"
    pos = 12
    while pos < length:
        clen, ctype = struct.unpack_from("<II", data, pos)
        if ctype == 0x4E4F534A:  # JSON
            return json.loads(data[pos + 8 : pos + 8 + clen])
        pos += 8 + clen + (clen & 3)
    raise RuntimeError("no JSON chunk")

def stats(g):
    meshes = g.get("meshes", [])
    mats = g.get("materials", [])
    nodes = g.get("nodes", [])
    verts = tris = 0
    prim_count = 0
    for m in meshes:
        for p in m.get("primitives", []):
            prim_count += 1
            acc = p["attributes"].get("POSITION")
            if acc is not None:
                verts += g["accessors"][acc]["count"]
            idx = p.get("indices")
            if idx is not None:
                tris += g["accessors"][idx]["count"] // 3
    tex = g.get("textures", [])
    imgs = g.get("images", [])
    return {
        "nodes": len(nodes),
        "meshes": len(meshes),
        "primitives": prim_count,
        "materials": len(mats),
        "vertices": verts,
        "triangles": tris,
        "textures": len(tex),
        "images": len(imgs),
        "extensionsRequired": g.get("extensionsRequired", []),
    }

raw = stats(load_glb_json("public/models/staging/mazda-rx-8-nfsmw.glb"))
cmp_ = stats(load_glb_json("public/models/mazda-rx-8-nfsmw.glb"))

print(f"{'metric':18} {'staging':>10} {'compressed':>12} {'match':>7}")
ok = True
for k in ["nodes", "meshes", "primitives", "materials", "vertices", "triangles", "textures", "images"]:
    same = raw[k] == cmp_[k]
    ok &= same
    print(f"{k:18} {raw[k]:>10} {cmp_[k]:>12} {'=' if same else 'DIFF':>7}")
print(f"{'extRequired':18} {','.join(raw['extensionsRequired']) or '-':>10} {','.join(cmp_['extensionsRequired']):>12}")

# vertex/triangle deltas from Draco quantization are expected to be 0
# (Draco is lossy on precision, not on counts); any count change = real loss
if ok:
    print("\nPARITY OK — all structural counts identical (Draco affects precision only)")
else:
    print("\nPARITY FAIL — counts differ, investigate before shipping")
    sys.exit(1)
