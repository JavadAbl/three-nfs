"""Measure green (vegetation) coverage in a game screenshot objectively.

Classifies pixels: green vegetation (g dominant, mid-brightness) vs sand/rock
(warm grey) vs sky (blue). Reports the share of each inside the mountain band
(below skyline, above road) — an objective 'forest density' metric.
"""
import sys
import numpy as np
from PIL import Image

path = sys.argv[1]
im = Image.open(path).convert("RGB")
w, h = im.size
a = np.asarray(im).astype(np.float32)
r, g, b = a[..., 0], a[..., 1], a[..., 2]
lum = 0.3 * r + 0.5 * g + 0.2 * b

sky = (b > r + 8) & (b > 90)
green = (g > r * 1.08) & (g > b * 1.05) & (g > 40) & (lum < 235)
warm = (~sky) & (~green)

# skyline per column
prof = np.full(w, h, dtype=int)
for x in range(w):
    ys = np.where(~sky[:, x])[0]
    if len(ys):
        prof[x] = ys[0]

# mountain band: from skyline down to skyline + 200px (or image bottom)
band_lo = prof.copy()
band_hi = np.minimum(prof + 200, h)
mask = np.zeros((h, w), dtype=bool)
for x in range(w):
    if prof[x] < h:
        mask[band_lo[x] : band_hi[x], x] = True

gs = (green & mask).sum()
ws = (warm & mask).sum()
ss = (sky & mask).sum()
tot = mask.sum()
print(f"band pixels: {tot}")
print(f"  green veg share: {gs / max(1, tot) * 100:.1f}%")
print(f"  warm/sand/rock:  {ws / max(1, tot) * 100:.1f}%")
print(f"  sky (leaks):     {ss / max(1, tot) * 100:.1f}%")

# whole-image green share
print(f"whole image green: {(green.sum() / (w * h)) * 100:.1f}%")
