#!/usr/bin/env python3
"""rx8_wheel_scan.py — check whether the RX-8's llantas/rines meshes hold all
four wheels merged (single mesh spanning the car) or one wheel each, plus the
lamp cluster materials (glass_red/white/yellow) world positions."""
import struct, json, sys
from collections import defaultdict

path = "public/models/staging/mazda-rx-8-nfsmw.glb"

with open(path, "rb") as f:
    data = f.read()

magic, ver, length = struct.unpack_from("<III", data, 0)
pos = 12
json_chunk = None
bin_start = None
while pos < length:
    clen, ctype = struct.unpack_from("<II", data, pos)
    body = data[pos + 8 : pos + 8 + clen]
    if ctype == 0x4E4F534A:
        json_chunk = json.loads(body)
    elif ctype == 0x004E4942:
        bin_start = pos + 8
    pos += 8 + clen + (clen & 3)

gltf = json_chunk
nodes = gltf["nodes"]
meshes = gltf["meshes"]
binblob = data[bin_start : bin_start + 0]  # placeholder; use accessor reads

def acc_data(ai):
    acc = gltf["accessors"][ai]
    bv = gltf["bufferViews"][acc["bufferView"]]
    off = bin_start + bv.get("byteOffset", 0) + acc.get("byteOffset", 0)
    count = acc["count"]
    comp = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4}[acc["type"]]
    fmt, sz = {"f": ("f", 4), "u": ("I", 4), "S": ("h", 2)}[acc.get("componentType") and "f" or "f"]
    # only float POSITION supported here
    vals = struct.unpack_from(f"<{count*3}f", data, off)
    return [vals[i*3:(i+1)*3] for i in range(count)]

# node → world matrix via scene traversal
def mat_mul(a, b):
    return [
        a[0]*b[0]+a[4]*b[1]+a[8]*b[2], a[1]*b[0]+a[5]*b[1]+a[9]*b[2], a[2]*b[0]+a[6]*b[1]+a[10]*b[2], 0,
        a[0]*b[4]+a[4]*b[5]+a[8]*b[6], a[1]*b[4]+a[5]*b[5]+a[9]*b[6], a[2]*b[4]+a[6]*b[5]+a[10]*b[6], 0,
        a[0]*b[8]+a[4]*b[9]+a[8]*b[10], a[1]*b[8]+a[5]*b[9]+a[9]*b[10], a[2]*b[8]+a[6]*b[9]+a[10]*b[10], 0,
        a[0]*b[12]+a[4]*b[13]+a[8]*b[14]+a[12], a[1]*b[12]+a[5]*b[13]+a[9]*b[14]+a[13], a[2]*b[12]+a[6]*b[13]+a[10]*b[14]+a[14], 1,
    ]

IDENT = [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]

def node_matrix(n):
    if "matrix" in n:
        return n["matrix"]
    m = IDENT[:]
    if "scale" in n:
        m = mat_mul(m, [n["scale"][0],0,0,0, 0,n["scale"][1],0,0, 0,0,n["scale"][2],0, 0,0,0,1])
    if "rotation" in n:
        q = n["rotation"]
        x,y,z,w = q
        r = [1-2*(y*y+z*z), 2*(x*y+z*w), 2*(x*z-y*w),0,
             2*(x*y-z*w), 1-2*(x*x+z*z), 2*(y*z+x*w),0,
             2*(x*z+y*w), 2*(y*z-x*w), 1-2*(x*x+y*y),0, 0,0,0,1]
        m = mat_mul(m, r)
    if "translation" in n:
        t = n["translation"]
        m = mat_mul(m, [1,0,0,0, 0,1,0,0, 0,0,1,0, t[0],t[1],t[2],1])
    return m

world = {}
def walk(ni, parent):
    m = mat_mul(parent, node_matrix(nodes[ni]))
    world[ni] = m
    for c in nodes[ni].get("children", []):
        walk(c, m)

for si in gltf["scenes"][gltf.get("scene", 0)]["nodes"]:
    walk(si, IDENT)

print("node_name | n_meshes | bbox_x | bbox_y | bbox_z | world_center")
targets = ["llantas", "rines", "glass_red", "glass_white", "glass_yellow", "FLASSSSS", "carriceria", "CRISTAL_FAROS", "chrome_lamps.001"]
for ni, n in enumerate(nodes):
    if "mesh" not in n:
        continue
    mesh = meshes[n["mesh"]]
    m = world[ni]
    allv = []
    for prim in mesh["primitives"]:
        pos_acc = prim["attributes"].get("POSITION")
        if pos_acc is None: continue
        for v in acc_data(pos_acc):
            allv.append((m[0]*v[0]+m[4]*v[1]+m[8]*v[2]+m[12], m[1]*v[0]+m[5]*v[1]+m[9]*v[2]+m[13], m[2]*v[0]+m[6]*v[1]+m[10]*v[2]+m[14]))
    if not allv:
        continue
    xs=[v[0] for v in allv]; ys=[v[1] for v in allv]; zs=[v[2] for v in allv]
    name = n.get("name", f"node{ni}")
    if not any(t in name for t in targets):
        continue
    print(f"{name[:44]:44} | {len(allv):6d}v | x[{min(xs):7.2f},{max(xs):7.2f}] y[{min(ys):6.2f},{max(ys):6.2f}] z[{min(zs):7.2f},{max(zs):7.2f}]")
