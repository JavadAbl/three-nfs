#!/usr/bin/env python3
"""World-space bbox per mesh (walks node TRS hierarchy) — for orientation calibration."""
import json, struct, sys

def load_glb(path):
    with open(path, "rb") as f:
        data = f.read()
    off = 12
    js = bin_ = None
    while off < len(data):
        clen, ctype = struct.unpack("<II", data[off:off+8])
        chunk = data[off+8:off+8+clen]
        if ctype == struct.unpack("<I", b"JSON")[0]:
            js = json.loads(chunk)
        else:
            bin_ = chunk
        off += 8 + clen + (clen & 3)
    return js, bin_

def quat_to_mat(q):
    x, y, z, w = q
    return [
        [1-2*(y*y+z*z), 2*(x*y-z*w),   2*(x*z+y*w)],
        [2*(x*y+z*w),   1-2*(x*x+z*z), 2*(y*z-x*w)],
        [2*(x*z-y*w),   2*(y*z+x*w),   1-2*(x*x+y*y)],
    ]

def node_matrix(n):
    t = n.get("translation", [0,0,0])
    s = n.get("scale", [1,1,1])
    r = n.get("rotation", [0,0,0,1])
    R3 = quat_to_mat(r)
    # M = T * R * S (4x4)
    M = [[0.0]*4 for _ in range(4)]
    for i in range(3):
        for j in range(3):
            M[i][j] = R3[i][j] * s[j]
        M[i][3] = t[i]
    M[3] = [0,0,0,1]
    return M

def mat_mul(A, B):
    return [[sum(A[i][k]*B[k][j] for k in range(4)) for j in range(4)] for i in range(4)]

def local_bbox(js, mesh):
    bb = None
    for p in mesh.get("primitives", []):
        acc = js["accessors"][p["attributes"]["POSITION"]]
        mn, mx = acc.get("min"), acc.get("max")
        if not mn or not mx: continue
        if bb is None: bb = [list(mn), list(mx)]
        else:
            for i in range(3):
                bb[0][i] = min(bb[0][i], mn[i]); bb[1][i] = max(bb[1][i], mx[i])
    return bb

def world_bbox(local, M):
    if not local: return None
    mn, mx = local
    corners = [(x,y,z) for x in (mn[0],mx[0]) for y in (mn[1],mx[1]) for z in (mn[2],mx[2])]
    out = None
    for x, y, z in corners:
        wx = M[0][0]*x + M[0][1]*y + M[0][2]*z + M[0][3]
        wy = M[1][0]*x + M[1][1]*y + M[1][2]*z + M[1][3]
        wz = M[2][0]*x + M[2][1]*y + M[2][2]*z + M[2][3]
        if out is None: out = [[wx,wy,wz],[wx,wy,wz]]
        else:
            for i in range(3):
                out[0][i] = min(out[0][i], [wx,wy,wz][i]); out[1][i] = max(out[1][i], [wx,wy,wz][i])
    return out

js, bin_ = load_glb(sys.argv[1])
nodes = js["nodes"]
mats = js["materials"]
results = []

def walk(idx, M):
    n = nodes[idx]
    Mw = mat_mul(M, node_matrix(n))
    mi = n.get("mesh")
    if mi is not None:
        local = local_bbox(js, js["meshes"][mi])
        wb = world_bbox(local, Mw)
        if wb:
            prim_mats = [mats[p.get("material")].get("name","?") for p in js["meshes"][mi].get("primitives", []) if p.get("material") is not None]
            results.append((n.get("name","?"), wb, prim_mats))
    for c in n.get("children", []):
        walk(c, Mw)

I = [[1,0,0,0],[0,1,0,0],[0,0,1,0],[0,0,0,1]]
for s in js.get("scenes", []):
    for r in s.get("nodes", []):
        walk(r, I)

print(f"{'node':60s} {'zcen':>7s} {'zspan':>18s} {'ycen':>6s} mats")
for name, wb, pm in sorted(results, key=lambda r: (r[1][0][2]+r[1][1][2])/2):
    zc = (wb[0][2]+wb[1][2])/2
    yc = (wb[0][1]+wb[1][1])/2
    print(f"{name[:60]:60s} {zc:7.3f} [{wb[0][2]:7.3f}..{wb[1][2]:7.3f}] {yc:6.3f} {pm}")
