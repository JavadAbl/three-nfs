#!/usr/bin/env python3
"""glass_mesh_scan.py — per GLB: list meshes using glass-named materials and
materials that look like interior evidence, with dims/centres, to decide the
glass policy per car. Raw (pre-normalization) coordinates in meters.
"""
import json, re, struct, sys, glob, os

GLASS = re.compile(r"glass|vit(re|e)|vidrio|windshield|window|plastic.?glass", re.I)
INTERIOR = re.compile(
    r"interior|seat|dash|cockpit|tissu|compteur|jauge|carpet|kili|salo|sedy|siege|console", re.I)
WATCH = re.compile(r"glass|vit(re|e)|vidrio|luz|grulle|plastic|interior|tissu|compteur|jauge|"
                   r"seat|dash|salo|sedy|kili|plasma|juoda|skyd|bagazine|caout", re.I)


def read_glb_json(path):
    f = open(path, "rb")
    magic, ver, total = struct.unpack("<4sII", f.read(12))
    assert magic == b"glTF"
    js = None
    while True:
        h = f.read(8)
        if len(h) < 8:
            break
        clen, ct = struct.unpack("<II", h)
        d = f.read(clen)
        if clen % 4:
            f.read(4 - clen % 4)
        if ct == struct.unpack("<I", b"JSON")[0]:
            js = json.loads(d)
    return js


def scan(path):
    js = read_glb_json(path)
    nodes, meshes, mats = js["nodes"], js["meshes"], js["materials"]
    for n in nodes:
        n["__parent"] = None
    for n in nodes:
        for c in n.get("children", []):
            nodes[c]["__parent"] = n

    import math

    def compose(t, r, s):
        m = [[1, 0, 0, 0], [0, 1, 0, 0], [0, 0, 1, 0], [0, 0, 0, 1]]
        x, y, z, w = r
        x2, y2, z2 = x + x, y + y, z + z
        xx, yy, zz = x * x2, y * y2, z * z2
        xy, xz, yz = x * y2, x * z2, y * z2
        wx, wy, wz = w * x2, w * y2, w * z2
        m[0][0] = (1 - (yy + zz)) * s[0]; m[0][1] = (xy - wz) * s[0]; m[0][2] = (xz + wy) * s[0]
        m[1][0] = (xy + wz) * s[1]; m[1][1] = (1 - (xx + zz)) * s[1]; m[1][2] = (yz - wx) * s[1]
        m[2][0] = (xz - wy) * s[2]; m[2][1] = (yz + wx) * s[2]; m[2][2] = (1 - (xx + yy)) * s[2]
        m[0][3], m[1][3], m[2][3] = t
        return m

    def matmul(a, b):
        return [[sum(a[i][k] * b[k][j] for k in range(4)) for j in range(4)] for i in range(4)]

    def own(n):
        if "matrix" in n:
            m = n["matrix"]
            return [m[0:4], m[4:8], m[8:12], m[12:16]]
        return compose(n.get("translation", [0, 0, 0]), n.get("rotation", [0, 0, 0, 1]),
                       n.get("scale", [1, 1, 1]))

    cache = {}

    def world(n):
        key = id(n)
        if key in cache:
            return cache[key]
        w = own(n)
        p = n.get("__parent")
        while p is not None:
            w = matmul(own(p), w)
            p = p.get("__parent")
        cache[key] = w
        return w

    def wbbox(n):
        w = world(n)
        out = None
        mi = n.get("mesh")
        if mi is None:
            return None
        for prim in meshes[mi].get("primitives", []):
            pos = prim.get("attributes", {}).get("POSITION")
            if pos is None:
                continue
            acc = js["accessors"][pos]
            mn, mx = acc.get("min"), acc.get("max")
            if not mn:
                continue
            pts = []
            for a in (mn[0], mx[0]):
                for b in (mn[1], mx[1]):
                    for c in (mn[2], mx[2]):
                        v = [a, b, c, 1]
                        pts.append([sum(w[i][k] * v[k] for k in range(4)) for i in range(3)])
            xs = [p[0] for p in pts]; ys = [p[1] for p in pts]; zs = [p[2] for p in pts]
            bb = (min(xs), min(ys), min(zs), max(xs), max(ys), max(zs))
            out = bb if out is None else (min(out[0], bb[0]), min(out[1], bb[1]), min(out[2], bb[2]),
                                          max(out[3], bb[3]), max(out[4], bb[4]), max(out[5], bb[5]))
        return out

    print(f"\n=== {os.path.basename(path)} ===")
    # reachable nodes only (orphaned JSON nodes are never instantiated by three.js)
    reachable = set()
    stack = list(js["scenes"][js.get("scene", 0)].get("nodes", []))
    while stack:
        ni = stack.pop()
        if ni in reachable:
            continue
        reachable.add(ni)
        stack.extend(nodes[ni].get("children", []))
    glass_meshes, interior_meshes = [], []
    for n in (nodes[i] for i in sorted(reachable)):
        if n.get("mesh") is None:
            continue
        names = [mats[p["material"]].get("name", "?")
                 for p in meshes[n["mesh"]].get("primitives", []) if "material" in p]
        for nm in set(names):
            if GLASS.search(nm) or nm.lower() in ("grulle", "vidrios", "emzone_plasmase1", "emzone_juoda1"):
                glass_meshes.append((n.get("name", "?"), nm, wbbox(n)))
            if INTERIOR.search(nm):
                interior_meshes.append((n.get("name", "?"), nm, wbbox(n)))

    print("GLASS-named material meshes:")
    for nn, nm, b in glass_meshes:
        if b:
            d = (b[3] - b[0], b[4] - b[1], b[5] - b[2])
            c = tuple(round((b[i * 3] + b[i * 3 + 3 - 1]) / 2 if False else (b[0] + b[3]) / 2, 2) for i in range(1))
            cx, cy, cz = (b[0] + b[3]) / 2, (b[1] + b[4]) / 2, (b[2] + b[5]) / 2
            print(f"  {nn:42s} [{nm:18s}] dims {d[0]:.2f}x{d[1]:.2f}x{d[2]:.2f} centre ({cx:+.2f},{cy:+.2f},{cz:+.2f})")
    print("INTERIOR-named material meshes:")
    for nn, nm, b in interior_meshes:
        if b:
            d = (b[3] - b[0], b[4] - b[1], b[5] - b[2])
            cx, cy, cz = (b[0] + b[3]) / 2, (b[1] + b[4]) / 2, (b[2] + b[5]) / 2
            print(f"  {nn:42s} [{nm:18s}] dims {d[0]:.2f}x{d[1]:.2f}x{d[2]:.2f} centre ({cx:+.2f},{cy:+.2f},{cz:+.2f})")


if __name__ == "__main__":
    for t in (sys.argv[1:] or sorted(glob.glob("/home/z/my-project/public/models/*.glb"))):
        try:
            scan(t)
        except Exception as e:
            print(f"\n=== {t} ===\n  FAILED: {e}")
