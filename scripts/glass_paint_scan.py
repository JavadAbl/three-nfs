#!/usr/bin/env python3
"""glass_paint_scan.py — audit every shipped car GLB for:
1. materials matching CarModelLoader's PAINT regexes (these get garage-tinted)
2. glass candidates (transparent, or glass-ish names)
3. interior evidence (meshes fully inside the cabin volume / interior-ish names)
Replicates the TS regexes from src/game/world/CarModelLoader.ts:
  paint = /carpaint/i || /(^|_)details$|(^|_)paint$/i || /by[_\s]/i || /painted/i || /(^|_)pickup$/
  (line ~370); NOT_LAMP_MAT = /glass|vidrio|windshield|window/i (line ~934)
"""
import json, re, struct, sys, glob, os

PAINT_PATTERNS = [
    re.compile(r"carpaint", re.I),
    re.compile(r"(^|_)details$|(^|_)paint$", re.I),
    re.compile(r"by[_\s]", re.I),
    re.compile(r"painted", re.I),
    re.compile(r"(^|_)pickup$", re.I),
]
GLASS_NAME = re.compile(r"glass|vitre|vidrio|windshield|window|fenster", re.I)
INTERIOR_NAME = re.compile(r"seat|dash|cockpit|interior|jauge|steer(ing)?_?wheel|siege|pommeau|shifter|gear.*lever", re.I)


def is_paint(name: str) -> bool:
    return any(p.search(name) for p in PAINT_PATTERNS)


def read_glb_json(path):
    with open(path, "rb") as f:
        magic, ver, total = struct.unpack("<4sII", f.read(12))
        assert magic == b"glTF", f"{path}: not a GLB"
        js = None
        bin_len = 0
        while True:
            hdr = f.read(8)
            if len(hdr) < 8:
                break
            clen, ctype = struct.unpack("<II", hdr)
            data = f.read(clen)
            if clen % 4:
                f.read(4 - (clen % 4))
            if ctype == struct.unpack("<I", b"JSON")[0]:
                js = json.loads(data.decode("utf-8"))
            else:
                bin_len = clen
        return js, bin_len


def mesh_node_world_bbox(js, node, cache):
    """very rough: walk to root applying matrices/TRS (handles both forms)."""
    key = id(node)
    if key in cache:
        return cache[key]
    # gather this node's own local matrix
    import math

    def compose(t, r, s):
        m = [[1, 0, 0, 0], [0, 1, 0, 0], [0, 0, 1, 0], [0, 0, 0, 1]]
        # scale, then rotate, then translate — full mat4 compose
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

    def own_matrix(n):
        if "matrix" in n:
            m = n["matrix"]
            return [m[0:4], m[4:8], m[8:12], m[12:16]]
        t = n.get("translation", [0, 0, 0])
        q = n.get("rotation", [0, 0, 0, 1])
        s = n.get("scale", [1, 1, 1])
        return compose(t, q, s)

    def apply(m, v):
        return [
            m[0][0] * v[0] + m[0][1] * v[1] + m[0][2] * v[2] + m[0][3],
            m[1][0] * v[0] + m[1][1] * v[1] + m[1][2] * v[2] + m[1][3],
            m[2][0] * v[0] + m[2][1] * v[1] + m[2][2] * v[2] + m[2][3],
        ]

    # build world matrix chain
    chain = [own_matrix(node)]
    parent = node.get("__parent")
    while parent is not None:
        chain.append(own_matrix(parent))
        parent = parent.get("__parent")
    world = chain[0]
    for m in chain[1:]:
        world = matmul(m, world)

    # mesh-local bbox from accessor min/max (if present)
    out = None
    mesh_idx = node.get("mesh")
    if mesh_idx is not None:
        mesh = js["meshes"][mesh_idx]
        for prim in mesh.get("primitives", []):
            pos = prim.get("attributes", {}).get("POSITION")
            if pos is None:
                continue
            acc = js["accessors"][pos]
            mn, mx = acc.get("min"), acc.get("max")
            if not mn or not mx:
                continue
            corners = []
            for a in (mn[0], mx[0]):
                for b in (mn[1], mx[1]):
                    for c in (mn[2], mx[2]):
                        corners.append(apply(world, [a, b, c]))
            xs = [p[0] for p in corners]; ys = [p[1] for p in corners]; zs = [p[2] for p in corners]
            bb = (min(xs), min(ys), min(zs), max(xs), max(ys), max(zs))
            out = bb if out is None else (
                min(out[0], bb[0]), min(out[1], bb[1]), min(out[2], bb[2]),
                max(out[3], bb[3]), max(out[4], bb[4]), max(out[5], bb[5]))
    cache[key] = out
    return out


def scan(path):
    js, bin_len = read_glb_json(path)
    nodes = js.get("nodes", [])
    meshes = js.get("meshes", [])
    mats = js.get("materials", [])

    # parent links
    for n in nodes:
        n["__parent"] = None
    for i, n in enumerate(nodes):
        for c in n.get("children", []):
            nodes[c]["__parent"] = n

    print(f"\n=== {os.path.basename(path)} ({bin_len/1e6:.1f} MB BIN) ===")
    print(f"materials: {len(mats)}, nodes: {len(nodes)}, meshes: {len(meshes)}")

    # per material: usage + transparent flag + paint flag
    usage = {i: 0 for i in range(len(mats))}
    for n in nodes:
        mi = n.get("mesh")
        if mi is None:
            continue
        for prim in meshes[mi].get("primitives", []):
            m = prim.get("material")
            if m is not None:
                usage[m] = usage.get(m, 0) + 1

    cache = {}
    paint_hits, glass_hits, interior_hits = [], [], []
    for i, m in enumerate(mats):
        name = m.get("name", "")
        alpha = m.get("alpha", 1.0)
        amode = m.get("alphaMode", "OPAQUE")
        base = m.get("pbrMetallicRoughness", {}).get("baseColorFactor", [1, 1, 1, 1])
        a = base[3] if len(base) > 3 else alpha
        transparent = amode in ("BLEND", "MASK") or a < 1.0
        p = is_paint(name)
        g = bool(GLASS_NAME.search(name))
        inter = bool(INTERIOR_NAME.search(name))
        if p:
            paint_hits.append((name, usage.get(i, 0)))
        if g or (transparent and not p):
            glass_hits.append((name, amode, round(a, 3), usage.get(i, 0)))
        if inter:
            interior_hits.append((name, usage.get(i, 0)))

    print("PAINT-matched (garage-tinted):")
    for name, u in paint_hits:
        print(f"  - {name!r}  ({u} prims)")
    print("GLASS candidates (name or transparent):")
    for name, amode, a, u in glass_hits:
        print(f"  - {name!r}  alphaMode={amode} alpha={a} ({u} prims)")
    print("INTERIOR-named materials:")
    for name, u in interior_hits:
        print(f"  - {name!r}  ({u} prims)")

    # whole-model bbox (root scene nodes) for cabin-volume reasoning
    boxes = []
    for si in js.get("scenes", [{}])[js.get("scene", 0)].get("nodes", []):
        def walk(ni):
            n = nodes[ni]
            b = mesh_node_world_bbox(js, n, cache)
            if b:
                boxes.append(b)
            for c in n.get("children", []):
                walk(c)
        walk(si)
    if boxes:
        wb = (min(b[0] for b in boxes), min(b[1] for b in boxes), min(b[2] for b in boxes),
              max(b[3] for b in boxes), max(b[4] for b in boxes), max(b[5] for b in boxes))
        print(f"model bbox: x[{wb[0]:.2f},{wb[3]:.2f}] y[{wb[1]:.2f},{wb[4]:.2f}] z[{wb[2]:.2f},{wb[5]:.2f}]")

    # meshes strictly inside the upper-middle cabin region (interior evidence)
    if boxes:
        wb = (min(b[0] for b in boxes), min(b[1] for b in boxes), min(b[2] for b in boxes),
              max(b[3] for b in boxes), max(b[4] for b in boxes), max(b[5] for b in boxes))
        inside = 0
        for b in boxes:
            w, h, l = b[3] - b[0], b[4] - b[1], b[5] - b[2]
            if w < 0.25 and h < 0.25 and l < 0.25:
                continue
            cx, cy, cz = (b[0] + b[3]) / 2, (b[1] + b[4]) / 2, (b[2] + b[5]) / 2
            if (0.1 * wb[3] < cx < 0.9 * wb[3] and cy < 0.75 * wb[4]
                    and 0.2 * wb[5] < cz < 0.8 * wb[5]):
                inside += 1
        print(f"meshes centered inside cabin volume (coarse): {inside}")


if __name__ == "__main__":
    targets = sys.argv[1:] or sorted(glob.glob("/home/z/my-project/public/models/*.glb"))
    for t in targets:
        try:
            scan(t)
        except Exception as e:
            print(f"\n=== {t} ===\n  SCAN FAILED: {e}")
