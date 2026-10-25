#!/usr/bin/env python3
"""Dump every material's name + emissiveFactor + emissiveTexture flag for the
4 car GLBs — to see the house emissive convention (which mats glow, how hot)."""
import json, struct, sys, glob

def load_glb(path):
    with open(path, "rb") as f:
        data = f.read()
    off = 12
    while off < len(data):
        clen, ctype = struct.unpack("<II", data[off:off+8])
        chunk = data[off+8:off+8+clen]
        if ctype == struct.unpack("<I", b"JSON")[0]:
            return json.loads(chunk)
        off += 8 + clen + (clen & 3)

for path in sys.argv[1:]:
    js = load_glb(path)
    print(f"\n=== {path.split('/')[-1]} ===")
    for i, m in enumerate(js.get("materials", [])):
        ef = m.get("emissiveFactor")            # glTF: material ROOT, not pbr
        etex = "emissiveTexture" in m
        ext = m.get("extensions", {})
        strength = ext.get("KHR_materials_emissive_strength", {}).get("emissiveStrength")
        s = sum(ef) if ef else 0.0
        print(f"  [{i:2d}] {m.get('name','?'):28s} emissiveFactor={ef} sum={s:5.2f} tex={etex} strength={strength}")
