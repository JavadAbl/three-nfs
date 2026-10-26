#!/usr/bin/env python3
"""Compare glow pool pixels across verify screenshots: what actually renders."""
from PIL import Image

def pool(path, label):
    img = Image.open(path).convert("RGB")
    w, h = img.size
    # left-of-car pool region (where the green AUTO glow showed clearly before)
    box = img.crop((int(w * 0.26), int(h * 0.44), int(w * 0.48), int(h * 0.68)))
    px = list(box.getdata())
    n = len(px)
    r = sum(p[0] for p in px) / n
    g = sum(p[1] for p in px) / n
    b = sum(p[2] for p in px) / n
    # dominant hue buckets
    cyan = sum(1 for p in px if p[2] > p[0] + 25 and p[2] > 45)
    green = sum(1 for p in px if p[1] > p[0] + 40 and p[1] > 70 and p[1] > p[2] + 25)
    warm = sum(1 for p in px if p[0] > p[2] + 40 and p[0] > 80)
    print(f"{label:34s}: avg=({r:5.1f},{g:5.1f},{b:5.1f})  cyan={cyan:5d}  green={green:5d}  warm={warm:5d}  (n={n})")

for path, label in [
    ("scripts/repro-cyan-toxic.png", "toxic paint + cyan tube (repro)"),
    ("scripts/verify-reset.png", "toxic paint + AUTO (after repaint)"),
    ("scripts/verify-tube2.png", "toxic paint + cyan tube (now)"),
]:
    pool(f"/home/z/my-project/{path}", label)
