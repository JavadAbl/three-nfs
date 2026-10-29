#!/usr/bin/env python3
"""Measure headlight-region brightness objectively: count warm-white pixels
(R>190, R>G>B) in the front-half crop — a lit halogen lamp leaves an
unmistakable cluster; an unlit lens area stays dark."""
from PIL import Image
import sys

CROP = (0.10, 0.25, 0.55, 0.80)

def stats(path):
    im = Image.open(path)
    w, h = im.size
    box = (int(CROP[0] * w), int(CROP[1] * h), int(CROP[2] * w), int(CROP[3] * h))
    im = im.crop(box)
    px = im.load()
    bright = []  # warm-white pixels
    for y in range(0, im.size[1], 2):
        for x in range(0, im.size[0], 2):
            r, g, b = px[x, y][:3]
            if r > 190 and r >= g > b - 10 and g > 150:  # warm white, not amber paint
                bright.append((x, y, r))
    n = len(bright)
    if n:
        cx = sum(p[0] for p in bright) / n
        cy = sum(p[1] for p in bright) / n
        mx = max(p[2] for p in bright)
        # cluster spread
        sx = max(p[0] for p in bright) - min(p[0] for p in bright)
        sy = max(p[1] for p in bright) - min(p[1] for p in bright)
        return f"bright={n:5d} maxR={mx} centroid=({cx:.0f},{cy:.0f}) spread={sx}x{sy}"
    return "bright=    0 (no warm-white cluster)"

for name in sys.argv[1:]:
    print(f"{name:28s} {stats(f'/home/z/my-project/scripts/shots/{name}.png')}")
