#!/usr/bin/env python3
"""Dump raw RGB values in a coarse grid around the car's left flank."""
from PIL import Image
import sys

path = sys.argv[1]
label = sys.argv[2] if len(sys.argv) > 2 else path
img = Image.open(path).convert("RGB")
w, h = img.size
# region: left-of-car lower area (where pools show), coarse 14x8 grid
x0, x1 = int(w * 0.22), int(w * 0.52)
y0, y1 = int(h * 0.42), int(h * 0.72)
crop = img.crop((x0, y0, x1, y1)).resize((14, 8))
print(f"=== {label} ===")
for row in range(8):
    print("  " + "  ".join(f"{crop.getpixel((c, row))[0]:3d},{crop.getpixel((c, row))[1]:3d},{crop.getpixel((c, row))[2]:3d}" for c in range(14)))
