#!/usr/bin/env python3
"""Scan halo-probe captures for a hard-edged bright blob near the car.

For each PNG: threshold bright pixels (luma > 170) in the bottom 65% (the
road/foreground the chase cam frames), keep the largest connected component,
and measure how RECTANGULAR its boundary is — a soft radial glow (correct
underglow/nitro) decays slowly toward its bbox edge; an additive quad with a
texture/UV bug snaps from full brightness to background in ~1 px.

Score = hardest-side step × (1 + number of snapping sides) × component area.
"""
import sys, glob
from collections import deque
import numpy as np
from PIL import Image

files = sorted(glob.glob(sys.argv[1] if len(sys.argv) > 1 else "/tmp/halo/*.png"))

def mean_safe(band, pts):
    vals = [band[y, x] for y, x in pts if 0 <= y < band.shape[0] and 0 <= x < band.shape[1]]
    return float(np.mean(vals)) if vals else 0.0

def analyze(path):
    im = np.asarray(Image.open(path).convert("L"), dtype=np.float32)
    H, W = im.shape
    y0 = int(H * 0.35)  # bottom 65% = road + foreground around the car
    band = im[y0:, :]
    bright = band > 170
    if bright.sum() < 24:
        return None
    # largest 4-connected component (BFS)
    visited = np.zeros_like(bright, dtype=bool)
    best_area, best_mask = 0, None
    ys, xs = np.nonzero(bright)
    for sy, sx in zip(ys, xs):
        if visited[sy, sx]:
            continue
        q = deque([(sy, sx)])
        visited[sy, sx] = True
        comp = np.zeros_like(bright, dtype=bool)
        comp[sy, sx] = True
        while q:
            y, x = q.popleft()
            for ny, nx in ((y-1, x), (y+1, x), (y, x-1), (y, x+1)):
                if 0 <= ny < band.shape[0] and 0 <= nx < band.shape[1] \
                   and bright[ny, nx] and not visited[ny, nx]:
                    visited[ny, nx] = True
                    comp[ny, nx] = True
                    q.append((ny, nx))
        if comp.sum() > best_area:
            best_area, best_mask = int(comp.sum()), comp
    comp = best_mask
    ys, xs = np.nonzero(comp)
    cy0, cy1, cx0, cx1 = ys.min(), ys.max(), xs.min(), xs.max()
    bw, bh = cx1 - cx0 + 1, cy1 - cy0 + 1
    area = len(ys)
    mid_in = float(np.mean(band[comp]))
    col = [(y, x) for y in range(cy0, cy1 + 1) for x in ()]  # placeholder
    L = mid_in - mean_safe(band, [(y, cx0 - 2) for y in range(cy0, cy1 + 1)])
    R = mid_in - mean_safe(band, [(y, cx1 + 2) for y in range(cy0, cy1 + 1)])
    T = mid_in - mean_safe(band, [(cy0 - 2, x) for x in range(cx0, cx1 + 1)])
    B = mid_in - mean_safe(band, [(cy1 + 2, x) for x in range(cx0, cx1 + 1)])
    steps = [s for s in (L, R, T, B) if s > 0]
    hard_sides = sum(1 for s in (L, R, T, B) if s > 90)  # sides that SNAP
    score = (max(steps) if steps else 0) * (1 + hard_sides) * area
    return dict(path=path, area=area, bbox=(bw, bh),
                steps=(round(L), round(R), round(T), round(B)), hard_sides=hard_sides,
                score=int(score), maxluma=int(band[comp].max()))

rows = []
for f in files:
    r = analyze(f)
    rows.append(r if r else dict(path=f, area=0, score=0))
rows.sort(key=lambda r: -r["score"])
for r in rows[:12]:
    print(f"{r['score']:>12}  area={r['area']:>6} bbox={r.get('bbox')} "
          f"steps={r.get('steps')} hard_sides={r.get('hard_sides')} max={r.get('maxluma')}  {r['path']}")
