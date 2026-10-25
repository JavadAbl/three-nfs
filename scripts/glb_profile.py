#!/usr/bin/env python3
"""ASCII roofline profile: max body+glass height along z, to find front/rear."""
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

js, bin_ = load_glb(sys.argv[1])

def positions_of_mesh(mesh):
    """yield (x,y,z) of all primitives (assume float32, uncompressed)."""
    out = []
    for p in mesh.get("primitives", []):
        acc_idx = p["attributes"]["POSITION"]
        acc = js["accessors"][acc_idx]
        bv = js["bufferViews"][acc["bufferView"]]
        start = bv.get("byteOffset", 0) + acc.get("byteOffset", 0)
        count = acc["count"]
        comp = acc["componentType"]  # 5126 = float32
        if comp != 5126:
            continue
        # skip sparse; stride default tight
        stride = bv.get("byteStride", 12)
        for i in range(count):
            o = start + i * stride
            x, y, z = struct.unpack_from("<fff", bin_, o)
            out.append((x, y, z))
    return out

# body shell + glass + interior = outer silhouette
targets = {}
for n in js["nodes"]:
    mi = n.get("mesh")
    if mi is None: continue
    name = n.get("name", "")
    if any(k in name for k in ["TTRS_0", "glass_0", "vidrios", "parrilla2", "bajo", "cromo_0"]):
        targets[name] = js["meshes"][mi]

pts = []
for name, mesh in targets.items():
    pts.extend(positions_of_mesh(mesh))

if not pts:
    print("no points"); sys.exit(1)

xs = [p[0] for p in pts]; ys = [p[1] for p in pts]; zs = [p[2] for p in pts]
print(f"points={len(pts)} x=[{min(xs):.2f},{max(xs):.2f}] y=[{min(ys):.2f},{max(ys):.2f}] z=[{min(zs):.2f},{max(zs):.2f}]")

# bin z into 60 slices, take max y (and 95th pct to drop spikes)
import collections
NB = 60
zmin, zmax = min(zs), max(zs)
bins = collections.defaultdict(list)
for x, y, z in pts:
    b = int((z - zmin) / (zmax - zmin) * (NB - 1))
    bins[b].append(y)

print("\nmax-height profile along z  (z increases to the right; rows = height 0..1.5m)")
ymaxes = []
for b in range(NB):
    ys_b = bins.get(b, [])
    ym = max(ys_b) if ys_b else 0
    ymaxes.append(ym)
for level in [1.4, 1.25, 1.1, 0.95, 0.8, 0.65, 0.5, 0.35, 0.2]:
    row = "".join("#" if y >= level else " " for y in ymaxes)
    print(f"y={level:4.2f} |{row}|")
print("        |" + "".join(("+" if b % 6 == 0 else "-") for b in range(NB)) + "|")
print(f"z-axis: left = {zmin:.2f}, right = {zmax:.2f}  (+z end on the RIGHT)")

# slope analysis: where does the height ramp up fastest?
prev = None
print("\nramp segments (dy > 0.08 between adjacent bins):")
for b in range(1, NB):
    d = ymaxes[b] - ymaxes[b-1]
    if abs(d) > 0.08:
        z_lo = zmin + (b-1) * (zmax-zmin)/NB
        print(f"  z≈{z_lo:+.2f} → {z_lo + (zmax-zmin)/NB:+.2f}: dy={d:+.2f}")
