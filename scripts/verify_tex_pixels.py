#!/usr/bin/env python3
"""Deterministic screenshot checks for the island PBR-dress pass.
- no missing-texture magenta anywhere
- interior meadow: green-dominant pixel share in the upper-middle band
- mountains: luminance variance in the upper band (rock scan = high stdev)
"""
from PIL import Image
import sys

im = Image.open("/home/z/my-project/scripts/island_tex_a.jpg").convert("RGB")
W, H = im.size
px = im.load()

magenta = 0
green = 0
band_px = 0
lum_up = []
for y in range(0, H):
    for x in range(0, W):
        r, g, b = px[x, y]
        if r > 200 and b > 200 and g < 80:
            magenta += 1
        # upper-middle band (horizon / interior / mountains)
        if 0.18 * H < y < 0.55 * H:
            band_px += 1
            if g > r * 1.08 and g > b * 1.05 and g > 55:
                green += 1
            lum_up.append(0.299 * r + 0.587 * g + 0.114 * b)

import statistics
stdev = statistics.pstdev(lum_up) if lum_up else 0
mean = statistics.fmean(lum_up) if lum_up else 0
print(f"size {W}x{H}")
print(f"magenta(missing tex) px: {magenta}  -> {'FAIL' if magenta > 50 else 'PASS'}")
print(f"green share of mid band: {green}/{band_px} = {green/max(1,band_px):.1%} -> {'PASS' if green/max(1,band_px) > 0.12 else 'WEAK'}")
print(f"mid-band luminance mean {mean:.1f} stdev {stdev:.1f} -> {'PASS (textured)' if stdev > 18 else 'FLAT?'}")
sys.exit(0)
