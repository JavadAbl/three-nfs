#!/usr/bin/env python3
"""Pixel-verify the muscle car's procedural paint on a side-view garage shot.

Bands are measured UP from the body's bottom pixel (y_hi) so the glass never
pollutes them: rocker grime lives in the bottom ~18% of the body height, the
clean door metal sits at 40-60%. If grime renders, the bottom band is darker.
"""
from PIL import Image

im = Image.open("/tmp/render/muscle_garage2.png").convert("RGB")
w, h = im.size
px = im.load()

def is_body(r, g, b):
    return r > 110 and r - b > 50 and r - g > 30 and g > b

pts = [(x, y) for y in range(int(h * 0.25), int(h * 0.85)) for x in range(int(w * 0.05), int(w * 0.95)) if is_body(*px[x, y])]
print(f"body pixels: {len(pts)}")
if not pts:
    raise SystemExit("no orange body pixels found")

ys = [y for _, y in pts]
y_lo, y_hi = min(ys), max(ys)
H = y_hi - y_lo

def band_lum(f0, f1):
    sel = [px[x, y] for x, y in pts if y_hi - H * f1 <= y <= y_hi - H * f0]
    if not sel:
        return None
    return sum(0.2126 * p[0] + 0.7152 * p[1] + 0.0722 * p[2] for p in sel) / len(sel)

rocker = band_lum(0.02, 0.18)
door = band_lum(0.40, 0.60)
print(f"rocker band (2-18% up): {rocker and round(rocker,1)}  door band (40-60% up): {door and round(door,1)}")
if rocker and door:
    print(f"grime darkening: {100 * (1 - rocker / door):.1f}%  {'OK' if rocker < door * 0.93 else 'TOO SUBTLE'}")
