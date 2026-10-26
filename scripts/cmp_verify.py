#!/usr/bin/env python3
"""Pixel-verify the 8 lamp-style compare shots (v7): front set compares
headlights, low set compares underglow. Glow on/off pairs MUST differ."""
from PIL import Image
import numpy as np

base = "/home/z/my-project/public/"

def load(n):
    return np.asarray(Image.open(base + n + ".png").convert("RGB"), dtype=np.int16)

def pair(a, b):
    ia, ib = load(a), load(b)
    d = np.abs(ia - ib).sum(axis=2)
    return d.mean(), (d > 12).sum(), d.max()

pairs = [
    ("front_halogen_glow", "front_halogen_noglow"),   # glow effect @front
    ("low_halogen_glow", "low_halogen_noglow"),       # glow effect @low
    ("front_halogen_noglow", "front_xenon_noglow"),   # lamp style @front
    ("low_halogen_noglow", "low_xenon_noglow"),       # lamp style @low
    ("front_halogen_glow", "front_xenon_glow"),       # combined
]
print(f"{'pair':52s} {'mean':>7s} {'px>12':>7s} {'max':>5s}")
for a, b in pairs:
    m, c, mx = pair(a, b)
    print(f"{a:26s} vs {b:26s} {m:7.2f} {c:7d} {mx:5d}")

# hue check: xenon road band should be BLUER (B - R higher than halogen)
for n in ["front_halogen_noglow", "front_xenon_noglow"]:
    im = load(n).astype(np.float32)
    bot = im[210:, :, :]
    print(f"{n:26s} road band: R={bot[:,:,0].mean():6.1f} B={bot[:,:,2].mean():6.1f} B-R={bot[:,:,2].mean()-bot[:,:,0].mean():+5.1f}")
