#!/usr/bin/env python3
"""Car-model node scanner: dumps every node's WORLD position/box + materials,
so wheel/paint/lamp renames can be planned before patching a GLB.

Accumulates glTF TRS transforms down the node hierarchy (quat→mat4), then
projects each mesh's accessor bbox through the world matrix into an AABB.
Also prints a per-material summary (mesh count + world z-extent) — the z
extent tells head vs tail for lamp-material rename planning.

Usage: python3 scripts/car_node_scan.py <file.glb> [--meshes-only]
"""
import json, struct, sys


def read_glb_json(path):
    with open(path, "rb") as f:
        magic, ver, total = struct.unpack("<4sII", f.read(12))
        assert magic == b"glTF", "not a GLB"
        js = None
        while True:
            hdr = f.read(8)
            if len(hdr) < 8:
                break
            clen, ctype = struct.unpack("<II", hdr)
            data = f.read(clen)
            if clen % 4:
                f.read(4 - clen % 4)
            if ctype == struct.unpack("<I", b"JSON")[0]:
                js = json.loads(data.decode("utf-8"))
        assert js, "no JSON chunk"
        return js


def mat_mul(a, b):
    return [[sum(a[i][k] * b[k][j] for k in range(4)) for j in range(4)] for i in range(4)]


def xform_point(m, v):
    return [m[i][0] * v[0] + m[i][1] * v[1] + m[i][2] * v[2] + m[i][3] for i in range(4)]


def node_local_matrix(n):
    if "matrix" in n:  # column-major 16 — used by FBX→glTF converters
        m = n["matrix"]
        return [
            [m[0], m[4], m[8], m[12]],
            [m[1], m[5], m[9], m[13]],
            [m[2], m[6], m[10], m[14]],
            [m[3], m[7], m[11], m[15]],
        ]
    t = n.get("translation", [0, 0, 0])
    s = n.get("scale", [1, 1, 1])
    q = n.get("rotation", [0, 0, 0, 1])  # glTF: x,y,z,w
    x, y, z, w = q
    nrm = (x * x + y * y + z * z + w * w) ** 0.5 or 1.0
    x, y, z, w = x / nrm, y / nrm, z / nrm, w / nrm
    r = [
        [1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
        [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
        [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)],
    ]
    m = [[r[i][j] * s[j] for j in range(3)] + [t[i]] for i in range(3)]
    m.append([0, 0, 0, 1])
    return m


IDENTITY = [[1 if i == j else 0 for j in range(4)] for i in range(4)]


def main(path, meshes_only):
    js = read_glb_json(path)
    nodes, meshes, mats, accessors = js["nodes"], js.get("meshes", []), js.get("materials", []), js["accessors"]

    world = {}
    children_of = {}
    parent_of = {}
    for i, n in enumerate(nodes):
        for c in n.get("children", []):
            children_of.setdefault(i, []).append(c)
            parent_of[c] = i

    def world_of(i):
        if i in world:
            return world[i]
        n = nodes[i]
        m = node_local_matrix(n)
        p = parent_of.get(i)
        if p is not None:
            m = mat_mul(world_of(p), m)
        world[i] = m
        return m

    mat_stats = {}  # matName -> [count, zmin, zmax]
    wheelish = []

    def walk(i, depth):
        n = nodes[i]
        m = world_of(i)
        wpos = xform_point(m, [0, 0, 0, 1])
        # annotate non-identity TRS so baked-identity vs transformed trees are visible
        trs = ""
        if any(abs(v) > 1e-9 for v in n.get("translation", [0, 0, 0])):
            trs += f" T={n.get('translation')}"
        if any(abs(v) > 1e-9 for v in n.get("rotation", [0, 0, 0, 1])[:-1]):
            trs += f" R={n.get('rotation')}"
        if any(abs(v - 1) > 1e-9 for v in n.get("scale", [1, 1, 1])):
            trs += f" S={n.get('scale')}"
        mi = n.get("mesh")
        line = None
        if mi is not None:
            names = []
            for p in meshes[mi].get("primitives", []):
                acc = accessors[p["attributes"]["POSITION"]]
                mn, mx = acc.get("min", [0, 0, 0]), acc.get("max", [0, 0, 0])
                pts = [xform_point(m, [a, b, c, 1]) for a in (mn[0], mx[0]) for b in (mn[1], mx[1]) for c in (mn[2], mx[2])]
                ws = [p[k] for p in pts for k in range(3)]
                wmn, wmx = [min(ws[k::3]) for k in range(3)], [max(ws[k::3]) for k in range(3)]
                dim = [wmx[k] - wmn[k] for k in range(3)]
                ctr = [(wmn[k] + wmx[k]) / 2 for k in range(3)]
                mat_name = mats[p["material"]].get("name", f"mat#{p['material']}") if "material" in p else "(none)"
                names.append(mat_name)
                st = mat_stats.setdefault(mat_name, [0, 1e9, -1e9])
                st[0] += 1
                st[1] = min(st[1], wmn[2])
                st[2] = max(st[2], wmx[2])
                line = (f"dims {dim[0]:.2f}x{dim[1]:.2f}x{dim[2]:.2f} centre ({ctr[0]:+.2f},{ctr[1]:+.2f},{ctr[2]:+.2f})"
                        f" mats={sorted(set(names))}")
            print("  " * depth + f"[{i}] {n.get('name','(unnamed)')}{trs}: {line}")
        else:
            print("  " * depth + f"[{i}] {n.get('name','(unnamed)')}{trs} org ({wpos[0]:+.2f},{wpos[1]:+.2f},{wpos[2]:+.2f})")
        if n.get("name") and __import__("re").search(r"wheel|brake|disc|rim|tire|tyre", n["name"], __import__("re").I):
            wheelish.append((n["name"], [round(v, 2) for v in wpos[:3]]))
        for c in children_of.get(i, []):
            walk(c, depth + 1)

    # scene roots
    for s in js.get("scenes", []):
        for r in s.get("nodes", []):
            walk(r, 0)

    print("\n=== WHEEL-ISH NAMED NODES (world pos) ===")
    for name, pos in wheelish:
        print(f"  {name:40s} x={pos[0]:+.2f} y={pos[1]:+.2f} z={pos[2]:+.2f}")
    print("\n=== MATERIALS (mesh count, world z-extent; z<0 rear / z>0 front BEFORE loader flip) ===")
    for name, (cnt, zmin, zmax) in sorted(mat_stats.items(), key=lambda kv: -kv[1][0]):
        print(f"  {name:40s} meshes={cnt:3d} z=[{zmin:+.2f}..{zmax:+.2f}]")


if __name__ == "__main__":
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    main(args[0], "--meshes-only" in sys.argv)
