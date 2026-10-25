#!/usr/bin/env python3
"""Vertex-level probe of the Audi's lamp meshes (TTRS_luz / TTRS_luz2):
decode POSITION accessors, apply node world matrix, cluster by z to see
which mesh holds head vs tail lamp geometry (Sketchfab merges by material).
"""
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
    t = n.get("translation", [0,0,0]); s = n.get("scale", [1,1,1]); r = n.get("rotation", [0,0,0,1])
    R3 = quat_to_mat(r)
    M = [[0.0]*4 for _ in range(4)]
    for i in range(3):
        for j in range(3): M[i][j] = R3[i][j] * s[j]
        M[i][3] = t[i]
    M[3] = [0,0,0,1]
    return M

def mat_mul(A, B):
    return [[sum(A[i][k]*B[k][j] for k in range(4)) for j in range(4)] for i in range(4)]

def positions(js, bin_, acc_idx):
    acc = js["accessors"][acc_idx]
    bv = js["bufferViews"][acc["bufferView"]]
    base = bv.get("byteOffset", 0) + acc.get("byteOffset", 0)
    comp = acc["componentType"]; n = acc["count"]
    fmt = "<" + "f" * (3*n) if comp == 5126 else None
    assert comp == 5126, f"componentType {comp} not float32"
    stride = bv.get("byteStride", 12)
    out = []
    for i in range(n):
        o = base + i * stride
        out.append(struct.unpack_from("<3f", bin_, o))
    return out

js, bin_ = load_glb("/home/z/my-project/public/models/audi-tt-rs-2010.glb")
nodes, meshes = js["nodes"], js["meshes"]

TARGETS = {"Mesh7_TTRS_luz_0", "Mesh8_TTRS_luz_0", "Mesh9_TTRS_luz2_0"}

def walk(idx, M):
    n = nodes[idx]
    Mw = mat_mul(M, node_matrix(n))
    if n.get("mesh") is not None and n.get("name") in TARGETS:
        mesh = meshes[n["mesh"]]
        for pi, p in enumerate(mesh.get("primitives", [])):
            verts = positions(js, bin_, p["attributes"]["POSITION"])
            # world transform
            wv = []
            for x, y, z in verts:
                wv.append((M[0][0]*x+M[0][1]*y+M[0][2]*z+M[0][3],
                           M[1][0]*x+M[1][1]*y+M[1][2]*z+M[1][3],
                           M[2][0]*x+M[2][1]*y+M[2][2]*z+M[2][3]))
            # cluster by z buckets of 0.5m
            buckets = {}
            for x, y, z in wv:
                b = round(z * 2) / 2  # nearest 0.5
                buckets.setdefault(b, []).append((x, y))
            print(f"\n{n['name']} prim{pi}: {len(wv)} verts")
            for b in sorted(buckets):
                pts = buckets[b]
                xs = [p[0] for p in pts]; ys = [p[1] for p in pts]
                print(f"   z~{b:+5.1f}: {len(pts):4d} verts  x[{min(xs):+5.2f}..{max(xs):+5.2f}]  y[{min(ys):5.2f}..{max(ys):5.2f}]")
    for c in n.get("children", []):
        walk(c, Mw)

I = [[1,0,0,0],[0,1,0,0],[0,0,1,0],[0,0,0,1]]
for s in js.get("scenes", []):
    for r in s.get("nodes", []):
        walk(r, I)
