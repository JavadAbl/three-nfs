#!/usr/bin/env python3
"""A/B luminance check for the garage turntable region.

The car preview is the left ~55% of the menu's RIDE step (1280x800 viewport).
We measure mean luminance + the fraction of pixels that are not near-black in
that region, for the before/after screenshots of the lighting change.
"""
import sys
from PIL import Image

def stats(path: str) -> None:
    im = Image.open(path).convert("L")
    w, h = im.size
    # turntable panel: left half of the content area, below the header
    crop = im.crop((int(w * 0.04), int(h * 0.18), int(w * 0.56), int(h * 0.92)))
    px = list(crop.getdata())
    n = len(px)
    mean = sum(px) / n
    dark = sum(1 for p in px if p < 16) / n
    mid = sum(1 for p in px if 16 <= p < 120) / n
    bright = sum(1 for p in px if p >= 120) / n
    # top band of the panel — where the roof lamps should show up
    top = im.crop((int(w * 0.04), int(h * 0.18), int(w * 0.56), int(h * 0.40)))
    tpx = list(top.getdata())
    tb = sum(1 for p in tpx if p >= 120) / len(tpx)
    tmean = sum(tpx) / len(tpx)
    print(f"{path}: mean_lum={mean:.1f} near-black={dark*100:.0f}% mid={mid*100:.0f}% "
          f"bright={bright*100:.0f}% | top-band mean={tmean:.1f} bright={tb*100:.1f}%")

for p in sys.argv[1:]:
    stats(p)
