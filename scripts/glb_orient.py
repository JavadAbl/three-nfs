#!/usr/bin/env python3
"""Analyze light materials + wheel groups to determine car orientation."""
import json, struct, sys

def load_json(path):
    with open(path, "rb") as f:
        data = f.read()
    off = 12
    js = None
    while off < len(data):
        clen, ctype = struct.unpack("<II", data[off:off+8])
        chunk = data[off+8:off+8+clen]
        if ctype == struct.unpack("<I", b"JSON")[0]:
            js = json.loads(chunk)
        off += 8 + clen + (clen & 3)
    return js

def mesh_bbox(js, mesh):
    """union bbox over primitives (accessor min/max)"""
    overall = None
    for p in mesh.get("primitives", []):
        acc = js["accessors"][p["attributes"]["POSITION"]]
        mn, mx = acc.get("min"), acc.get("max")
        if not mn or not mx: continue
        if overall is None: overall = [list(mn), list(mx)]
        else:
            for i in range(3):
                overall[0][i] = min(overall[0][i], mn[i])
                overall[1][i] = max(overall[1][i], mx[i])
    return overall

js = load_json(sys.argv[1])
mats = js["materials"]

print("== MATERIALS (baseColor / emissive) ==")
for i, m in enumerate(mats):
    pbr = m.get("pbrMetallicRoughness", {})
    bc = pbr.get("baseColorFactor", [1,1,1,1])
    em = m.get("emissiveFactor", [0,0,0])
    print(f"[{i}] {m.get('name')}: base=[{bc[0]:.2f},{bc[1]:.2f},{bc[2]:.2f}] emissive=[{em[0]:.2f},{em[1]:.2f},{em[2]:.2f}]")

print("\n== MESHES (bbox center, mats) ==")
nodes = js["nodes"]
for ni, n in enumerate(nodes):
    mi = n.get("mesh")
    if mi is None: continue
    mesh = js["meshes"][mi]
    bb = mesh_bbox(js, mesh)
    if not bb: continue
    cx, cy, cz = [(bb[0][i]+bb[1][i])/2 for i in range(3)]
    dz = bb[1][2]-bb[0][2]
    prim_mats = [mats[p.get("material")].get("name","?") for p in mesh.get("primitives", []) if p.get("material") is not None]
    print(f"node[{ni}] '{n.get('name')}': center=({cx:.3f},{cy:.3f},{cz:.3f}) zspan=[{bb[0][2]:.3f}..{bb[1][2]:.3f}] mats={prim_mats}")
