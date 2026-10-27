"""Locate the balcony/building contamination in the island sky source HDR.

The source is Poly Haven's "Illovo Beach Balcony" — shot FROM a balcony, so the
building's roof, walls and railing are baked into the panorama around the camera.
This script classifies pixels vs. sky and prints the contaminated azimuth ranges.
"""
import imageio.v3 as iio
import numpy as np
from PIL import Image

SRC = "/home/z/my-project/scripts/sky_src_island.hdr"

img = iio.imread(SRC).astype(np.float32)
H, W, _ = img.shape
print(f"source {W}x{H}")

lum = 0.2126 * img[..., 0] + 0.7152 * img[..., 1] + 0.0722 * img[..., 2]
r, g, b = img[..., 0], img[..., 1], img[..., 2]

# locate photo horizon: the sea/land rows have distinct luminance vs sky.
# print row mean luminance profile around the middle
row_lum = lum.mean(axis=1)
prev = row_lum[0]
print("row luminance steps (looking for the horizon kink):")
for y in range(int(H * 0.40), int(H * 0.62), 4):
    print(f"  row {y:4d} ({(0.5-y/H)*180:+6.1f} deg): mean lum {row_lum[y]:8.3f}")

# per-row robust sky statistics over ALL columns: the median is sky almost everywhere
med_lum = np.median(lum, axis=1)          # (H,)
med_b_minus_r = np.median(b - r, axis=1)  # sky is blue-dominant

# classify: a pixel is "structure" if it is much brighter than the sky mode at
# that elevation (white walls/roof), much darker (beams/shadows), or strongly
# warm (wood/railing) where the sky would be blue
bright = lum > med_lum[:, None] * 1.6 + 0.05
dark = lum < med_lum[:, None] * 0.45
warm = (r - b) > 0.02  # sky has b > r; man-made wood/cream has r >= b
not_sky = (bright | dark | warm)

# ignore the sun: extremely bright disc columns are legitimate. The sun shows up
# as bright — but only in a small column range. We'll report column profiles and
# eyeball which bright range is the sun vs which is structure.
frac = not_sky[: H // 2].mean(axis=0)  # fraction per column, upper half only

print("\ncolumn non-sky fraction profile (upper half), 16-column buckets:")
for x0 in range(0, W, 128):
    f = frac[x0 : x0 + 128].mean()
    bar = "#" * int(f * 60)
    print(f"  col {x0:4d}-{x0+127:4d} (u {x0/W:.3f}-{(x0+128)/W:.3f}): {f:.3f} {bar}")

# save a tone-mapped preview of the upper half for VLM cross-check
toned = np.log1p(img) / np.log1p(img.max())
Image.fromarray((toned[: H // 2] * 255).astype(np.uint8)).save(
    "/home/z/my-project/scripts/src_upper_half.png"
)

# report contiguous contaminated ranges (threshold 0.15 of pixels non-sky)
mask = frac > 0.15
ranges = []
x = 0
while x < W:
    if mask[x]:
        s = x
        while x < W and mask[x]:
            x += 1
        ranges.append((s, x - 1))
    else:
        x += 1
print("\ncontaminated column ranges (upper half, frac>0.15):")
for s, e in ranges:
    print(f"  cols {s}-{e}  (u {s/W:.4f}-{e/W:.4f}, az {(s/W)*360:.0f}-{(e/W)*360:.0f} deg, width {e-s+1})")
