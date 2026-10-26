#!/usr/bin/env python3
"""Objective A/B analysis of the headlight screenshots.
Finds where the two images differ, then reports brightness in those regions."""
from PIL import Image, ImageChops
import sys

before = Image.open("/home/z/my-project/download/lamp_ab_before.png").convert("RGB")
after = Image.open("/home/z/my-project/download/lamp_ab_after.png").convert("RGB")
w, h = before.size
print(f"size: {w}x{h}")

# absolute difference
diff = ImageChops.difference(before, after)
diff_rgb = diff.load()

# grid the image into cells, find cells with notable differences
cell = 20
rows = h // cell
cols = w // cell
cells = []
for r in range(rows):
    for c in range(cols):
        s = 0
        for y in range(r * cell, (r + 1) * cell):
            for x in range(c * cell, (c + 1) * cell):
                p = diff_rgb[x, y]
                s += p[0] + p[1] + p[2]
        cells.append((s, r, c))
cells.sort(reverse=True)
print("\ntop-12 differing cells (sum-diff, row, col):")
for s, r, c in cells[:12]:
    print(f"  cell({r},{c}) diff={s}  → pixel region x={c*cell}-{(c+1)*cell} y={r*cell}-{(r+1)*cell}")

def region_lum(img, x0, y0, x1, y1):
    px = img.load()
    tot = n = 0
    bright = 0
    for y in range(y0, y1):
        for x in range(x0, x1):
            p = px[x, y]
            l = 0.2126 * p[0] + 0.7152 * p[1] + 0.0722 * p[2]
            tot += l
            n += 1
            if l > 200: bright += 1
    return tot / n, bright

# analyze the top-5 differing regions in both images
print("\nbrightness in top differing regions (mean-luma, bright-pixel-count):")
for s, r, c in cells[:5]:
    x0, y0, x1, y1 = c * cell, r * cell, (c + 1) * cell, (r + 1) * cell
    mb, bb = region_lum(before, x0, y0, x1, y1)
    ma, ba = region_lum(after, x0, y0, x1, y1)
    print(f"  region x={x0}-{x1} y={y0}-{y1}: BEFORE mean={mb:.1f} bright={bb} | AFTER mean={ma:.1f} bright={ba}")

# also: overall brightest pixels in the central car area (bottom 2/3 of image, middle half)
print("\ncentral car area brightest stats:")
def stats(img, name):
    px = img.load()
    vals = []
    for y in range(h // 3, h, 2):
        for x in range(w // 4, 3 * w // 4, 2):
            p = px[x, y]
            vals.append(0.2126 * p[0] + 0.7152 * p[1] + 0.0722 * p[2])
    vals.sort(reverse=True)
    print(f"  {name}: top-50 mean={sum(vals[:50])/50:.0f}, top-500 mean={sum(vals[:500])/500:.0f}, p99={vals[len(vals)//100]:.0f}")
stats(before, "BEFORE")
stats(after, "AFTER ")
