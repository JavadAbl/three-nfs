#!/usr/bin/env python3
"""Full GLB node tree dump with TRS + mesh->material mapping."""
import json, struct, sys

def dump(path):
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

    nodes = js["nodes"]
    meshes = js.get("meshes", [])
    mats = js.get("materials", [])

    def matname(i): return mats[i].get("name", f"mat{i}") if i is not None else "?"

    def walk(idx, depth):
        n = nodes[idx]
        pad = "  " * depth
        t = n.get("translation", [0,0,0]); r = n.get("rotation", [0,0,0,1]); s = n.get("scale", [1,1,1])
        trs = ""
        if t != [0,0,0]: trs += f" T=[{t[0]:.3f},{t[1]:.3f},{t[2]:.3f}]"
        if s != [1,1,1]: trs += f" S=[{s[0]:.3f},{s[1]:.3f},{s[2]:.3f}]"
        if r != [0,0,0,1]: trs += " R=y"
        mi = n.get("mesh")
        mstr = ""
        if mi is not None:
            mesh = meshes[mi]
            prim_mats = [matname(p.get("material")) for p in mesh.get("primitives", [])]
            mstr = f"  <mesh '{mesh.get('name','?')}' mats={prim_mats}>"
        print(f"{pad}[{idx}] '{n.get('name','?')}'{trs}{mstr}")
        for c in n.get("children", []):
            walk(c, depth+1)

    for s in js.get("scenes", []):
        for r in s.get("nodes", []):
            walk(r, 0)

for p in sys.argv[1:]:
    print(f"=== {p} ===")
    dump(p)
