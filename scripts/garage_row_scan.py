#!/usr/bin/env python3
"""Row-profile scan of the garage panel: verify both roof-lamp rows render.

Scans each pixel row of the turntable panel's upper half and counts bright
pixels (>=120). Two lamp rows should produce two distinct peaks.
"""
from PIL import Image

im = Image.open("/tmp/render/garage_lamps.png").convert("L")
w, h = im.size
x0, x1 = int(w * 0.04), int(w * 0.56)
y0, y1 = int(h * 0.10), int(h * 0.45)

rows = []
for y in range(y0, y1):
    cnt = sum(1 for x in range(x0, x1) if im.getpixel((x, y)) >= 120)
    rows.append((y, cnt))

# print local maxima clusters (runs of rows with cnt above half the max)
mx = max(c for _, c in rows)
print(f"scan rows {y0}-{y1}, max bright-per-row = {mx}")
clusters = []
cur = None
for y, c in rows:
    if c > mx * 0.4:
        if cur is None:
            cur = [y, y, c]
        else:
            cur[1] = y
            cur[2] = max(cur[2], c)
    else:
        if cur is not None:
            clusters.append(cur)
            cur = None
if cur is not None:
    clusters.append(cur)

for y_start, y_end, c in clusters:
    print(f"bright band: rows {y_start}-{y_end} (height {y_end - y_start + 1}px, max {c}px/row)")
print(f"-> {len(clusters)} distinct bright band(s) detected")
