#!/usr/bin/env python3
"""Dump GLB structure: node names, meshes, materials, extensions, dims."""
import json, struct, sys

def dump(path):
    with open(path, "rb") as f:
        data = f.read()
    if data[:4] != b"glTF":
        print(f"{path}: NOT A GLB"); return
    ver, total = struct.unpack("<II", data[4:12])
    # iterate chunks
    off = 12
    js = None
    while off < len(data):
        clen, ctype = struct.unpack("<II", data[off:off+8])
        chunk = data[off+8:off+8+clen]
        if ctype == struct.unpack("<I", b"JSON")[0]:  # JSON chunk
            js = json.loads(chunk)
        off += 8 + clen + (clen & 3)
    print(f"=== {path} ({total/1e6:.2f} MB, glTF {ver}) ===")
    exts = js.get("extensionsUsed", [])
    print("extensionsUsed:", exts)
    # node names
    nodes = js.get("nodes", [])
    print(f"nodes: {len(nodes)}")
    wheelish = [n["name"] for n in nodes if "name" in n and any(k in n["name"].lower() for k in ["wheel", "tyre", "tire", "rim"])]
    print("wheel-ish node names (first 12):", wheelish[:12])
    all_names = [n.get("name", f"node{i}") for i, n in enumerate(nodes)]
    print("all node names (first 30):", all_names[:30])
    # materials
    mats = js.get("materials", [])
    print(f"materials: {len(mats)}")
    for m in mats[:15]:
        print("   -", m.get("name"))
    # mesh dims via accessor min/max of first POSITION
    for mid, mesh in enumerate(js.get("meshes", [])[:10]):
        prims = mesh.get("primitives", [])
        if prims:
            pos_acc = prims[0]["attributes"].get("POSITION")
            acc = js["accessors"][pos_acc]
            mn, mx = acc.get("min"), acc.get("max")
            if mn and mx:
                dx, dy, dz = (mx[0]-mn[0], mx[1]-mn[1], mx[2]-mn[2])
                print(f"mesh '{mesh.get('name','?')}': dims {dx:.2f} x {dy:.2f} x {dz:.2f}")
    # scene root scale hints
    for s in js.get("scenes", [])[:1]:
        print("scene roots:", [nodes[i].get("name", i) for i in s.get("nodes", [])])
    print()

for p in sys.argv[1:]:
    dump(p)
