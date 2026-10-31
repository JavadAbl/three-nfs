#!/usr/bin/env python3
"""Map the whole user screenshot: car body (red), kerb (yellow), and EVERY
bright region (luma>165), so we can tell road paint / kerb art apart from the
halo artifact. Prints a coarse ASCII map + region stats, saves an annotated
blow-up."""
import numpy as np
from PIL import Image, ImageDraw

SRC = "/home/z/my-project/upload/pasted_image_1793434771030.png"
im = Image.open(SRC).convert("RGB")
rgb = np.asarray(im, dtype=np.float32)
H, W = rgb.shape[:2]
R, G, B = rgb[..., 0], rgb[..., 1], rgb[..., 2]
luma = 0.2126 * R + 0.7152 * G + 0.0722 * B

red = (R > 90) & (R > G * 1.6) & (R > B * 1.6)          # car paint
yellow = (R > 120) & (G > 90) & (B < G * 0.75) & (R > B * 1.4)  # kerb
bright = luma > 165                                       # any bright px
bright_on_road = bright & ~red & ~yellow

# ASCII map: 12 cols x 14 rows of cells; each cell 14x14 px
cw, ch = W // 12, H // 14
print("legend: C=car-red, Y=yellow-kerb, #=bright(>165) on gray, .=dark/other")
print("    " + "".join(f"{i:>{cw}}" for i in range(12)))
for r in range(14):
    row = []
    for c in range(12):
        cell_r = red[r*ch:(r+1)*ch, c*cw:(c+1)*cw]
        cell_y = yellow[r*ch:(r+1)*ch, c*cw:(c+1)*cw]
        cell_b = bright_on_road[r*ch:(r+1)*ch, c*cw:(c+1)*cw]
        if cell_r.mean() > 0.30: row.append("C")
        elif cell_r.mean() > 0.12: row.append("c")
        elif cell_y.mean() > 0.20: row.append("Y")
        elif cell_b.mean() > 0.25: row.append("#")
        elif cell_b.mean() > 0.08: row.append("+")
        else: row.append(".")
    print(f"r{r:02d} " + "".join(f"{s:>{cw}}" for s in row))

# stats for every bright connected region on non-red/non-yellow pixels
from collections import deque
visited = np.zeros_like(bright, dtype=bool)
regions = []
for sy in range(H):
    for sx in range(W):
        if not bright[sy, sx] or visited[sy, sx]:
            continue
        q = deque([(sy, sx)]); visited[sy, sx] = True
        pts = []
        while q:
            y, x = q.popleft(); pts.append((y, x))
            for ny, nx in ((y-1,x),(y+1,x),(y,x-1),(y,x+1)):
                if 0 <= ny < H and 0 <= nx < W and bright[ny, nx] and not visited[ny, nx]:
                    visited[ny, nx] = True; q.append((ny, nx))
        if len(pts) < 20: continue
        ys = [p[0] for p in pts]; xs = [p[1] for p in pts]
        y0, y1, x0, x1 = min(ys), max(ys), min(xs), max(xs)
        frac_ry = np.mean([red[p[0], p[1]] or yellow[p[0], p[1]] for p in pts])
        mrgb = rgb[ys, xs].mean(axis=0)
        regions.append((len(pts), x0, x1, y0, y1, frac_ry, mrgb))
regions.sort(reverse=True)
print("\nbright regions (area, bbox x0:x1 y0:y1, frac-on-red/yellow, meanRGB):")
for a, x0, x1, y0, y1, f, m in regions[:12]:
    print(f"  area={a:5d}  x {x0:3d}-{x1:3d}  y {y0:3d}-{y1:3d}  ({x1-x0+1}x{y1-y0+1})  onCarKerb={f:.2f}  RGB={m.round(0)}")

# annotated blow-up
s = 6
big = im.resize((W * s, H * s), Image.LANCZOS)
d = ImageDraw.Draw(big, "RGBA")
for a, x0, x1, y0, y1, f, m in regions[:8]:
    col = (0, 255, 0, 255) if f > 0.5 else (255, 0, 255, 255)
    d.rectangle([x0 * s, y0 * s, x1 * s, y1 * s], outline=col, width=3)
big.save("/tmp/halo_annot.png")
print("\nsaved /tmp/halo_annot.png  (green box = bright ON car/kerb, magenta = bright on road)")
