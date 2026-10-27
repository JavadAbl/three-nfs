"""Extract the mountain silhouette from a game screenshot and measure its
raggedness objectively (no VLM guesswork).

Classifies sky (blue-dominant, bright) vs land (everything else), finds the
top-most land pixel per column, prints an ASCII skyline + stats.
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
# sky: blue-dominant AND bright (covers haze gradient too)
sky = (b > r + 8) & (b > 90)
# find per-column highest land pixel
prof = np.full(w, h, dtype=int)
for x in range(w):
    ys = np.where(~sky[:, x])[0]
    if len(ys):
        prof[x] = ys[0]

# print ASCII skyline (downsample to 120 cols, 24 rows)
cols = 120
step = max(1, w // cols)
sky_h = prof[::step][:cols]
lo = sky_h.min()
hi = max(sky_h.max(), lo + 1)
rows_n = 22
grid = [[" "] * cols for _ in range(rows_n)]
for i, y in enumerate(sky_h):
    t = int((y - lo) / (hi - lo) * (rows_n - 1))
    grid[t][i] = "█"
print("skyline profile (top of image = sky):")
for row in grid:
    print("".join(row))

# raggedness stats over the central mountain band
band = prof[int(w * 0.2) : int(w * 0.8)]
diffs = np.abs(np.diff(band.astype(float)))
peaks = 0
for k in range(2, len(band) - 2):
    window = band[k - 2 : k + 3]
    if band[k] == min(window) and band[k] < band[k - 2] - 3 and band[k] < band[k + 2] - 3:
        peaks += 1
print(f"\nskyline height range: {band.max() - band.min()} px")
print(f"mean |step| between columns: {diffs.mean():.2f} px")
print(f"local summits in the band: {peaks}")
print(f"jag (mean step / range): {(diffs.mean() / max(1, band.max() - band.min())):.3f}")
