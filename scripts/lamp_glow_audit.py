#!/usr/bin/env python3
"""Pixel audit of the new texture-driven lamp glow (viper08 + audi, night).
Chase-cam rear view: taillight region should show BAKED detailed red glow.
Front-swung view: headlight region should show textured warm-white glow
(lens/reflector texels), NOT a flat sticker blob, NOT dark.
"""
import sys
from PIL import Image

def region_stats(path, label):
    im = Image.open(path).convert("RGB")
    w, h = im.size
    px = im.load()
    # scan full frame in a grid, report bright clusters + red clusters
    bright = red = warm = 0
    bx = by = rx = ry = wx = wy = 0  # centroids
    for y in range(0, h, 2):
        for x in range(0, w, 2):
            r, g, b = px[x, y]
            if min(r, g, b) > 200:
                bright += 1; bx += x; by += y
            if r > 150 and r > g * 2.2 and r > b * 2.2:
                red += 1; rx += x; ry += y
            if r > 190 and g > 150 and b < 140 and r > b * 1.7:  # warm white
                warm += 1; wx += x; wy += y
    n = (w // 2) * (h // 2)
    print(f"== {label} ({w}x{h}, sampled {n}) ==")
    if bright:
        print(f"  bright-white px: {bright:4d} ({bright*100/n:.2f}%) centroid=({bx//bright},{by//bright})")
    else:
        print("  bright-white px: 0  <- HEADLIGHTS DARK?")
    if red:
        print(f"  saturated-red px: {red:4d} ({red*100/n:.2f}%) centroid=({rx//red},{ry//red})")
    else:
        print("  saturated-red px: 0  <- TAILLIGHTS DARK?")
    if warm:
        print(f"  warm-white px: {warm:4d} ({warm*100/n:.2f}%) centroid=({wx//warm},{wy//warm})")
    else:
        print("  warm-white px: 0")

for p, lbl in [
    ("/home/z/my-project/download/viper08_rear_newlook.png", "VIPER08 REAR (chase)"),
    ("/home/z/my-project/download/viper08_front_newlook.png", "VIPER08 FRONT (swung cam)"),
]:
    region_stats(p, lbl)
