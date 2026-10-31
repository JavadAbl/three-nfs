#!/usr/bin/env python3
"""Extract the hard-edged bright blob from the user's halo screenshot.

Reuses analyze_halo_shots.py's threshold+CC logic, then reports the blob's
full-image bbox, mean RGB (which light source? white=headlamp, red=tail,
blue=neon, orange=nitro), fill ratio (rectangle vs blob), and saves a 12x
nearest blow-up with the blob outlined for VLM identification.
"""
import sys
from collections import deque
import numpy as np
from PIL import Image, ImageDraw

SRC = "/home/z/my-project/upload/pasted_image_1793434771030.png"
im_rgb = Image.open(SRC).convert("RGB")
im = np.asarray(im_rgb.convert("L"), dtype=np.float32)
rgb = np.asarray(im_rgb, dtype=np.float32)
H, W = im.shape
y0 = int(H * 0.35)
band = im[y0:, :]
bright = band > 170

# largest 4-connected component
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
        for ny, nx in ((y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1)):
            if 0 <= ny < band.shape[0] and 0 <= nx < band.shape[1] \
               and bright[ny, nx] and not visited[ny, nx]:
                visited[ny, nx] = True
                comp[ny, nx] = True
                q.append((ny, nx))
    if comp.sum() > best_area:
        best_area, best_mask = int(comp.sum()), comp

comp = best_mask
ys, xs = np.nonzero(comp)
by0, by1, bx0, bx1 = ys.min(), ys.max(), xs.min(), xs.max()
bw, bh = bx1 - bx0 + 1, by1 - by0 + 1
fill = best_area / (bw * bh)
# mean colour of blob pixels (in full-image coords)
mask_full = np.zeros_like(im, dtype=bool)
mask_full[y0 + by0: y0 + by1 + 1, bx0: bx1 + 1] = comp[by0:by1 + 1, bx0:bx1 + 1] & True
# rebuild exact mask in full coords
mask_full = np.zeros_like(im, dtype=bool)
for y, x in zip(ys, xs):
    mask_full[y0 + y, x] = True
mean_rgb = rgb[mask_full].mean(axis=0)
# surrounding ring colour (dilation minus blob) = what it sits on
from scipy import ndimage  # noqa
dil = ndimage.binary_dilation(mask_full, iterations=3)
ring_rgb = rgb[dil & ~mask_full].mean(axis=0)

print(f"image {W}x{H}, band y0={y0}")
print(f"blob bbox full-image: x {bx0}..{bx1} ({bw}px), y {y0+by0}..{y0+by1} ({bh}px)")
print(f"area={best_area} fill={fill:.2f} (1.0 = solid rectangle)")
print(f"blob mean RGB   = {mean_rgb.round(0)}")
print(f"ring mean RGB   = {ring_rgb.round(0)}")
print(f"blob centre     = ({(bx0+bx1)/2/W:.2f}, {(y0+by0+y0+by1)/2/H:.2f}) of frame")

# blow-up with outline
cx0, cx1 = max(0, bx0 - 22), min(W, bx1 + 23)
cy0, cy1 = max(0, y0 + by0 - 22), min(H, y0 + by1 + 23)
crop = im_rgb.crop((cx0, cy0, cx1, cy1))
s = 12
big = crop.resize((crop.width * s, crop.height * s), Image.NEAREST)
d = ImageDraw.Draw(big, "RGBA")
d.rectangle([(bx0 - cx0) * s, (y0 + by0 - cy0) * s, (bx1 - cx0 + 1) * s, (y0 + by1 - cy0 + 1) * s], outline=(255, 0, 0, 255), width=4)
big.save("/tmp/halo_blob_zoom.png")
print(f"zoom crop saved: x {cx0}..{cx1}, y {cy0}..{cy1} -> /tmp/halo_blob_zoom.png ({big.size})")
