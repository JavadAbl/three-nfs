#!/usr/bin/env python3
"""Crop headlight region from garage screenshots for VLM close-up analysis.
Camera (5.6,2.3,6.8) → front-right 3/4 view, nose points screen-left."""
from PIL import Image

CROP = (0.12, 0.25, 0.60, 0.75)  # generous front-half crop

for name in ["garage_gtr_after", "garage_r5_after", "garage_audi_after", "garage_viper08_after", "garage_viper16_after"]:
    im = Image.open(f"/home/z/my-project/scripts/shots/{name}.png")
    w, h = im.size
    box = (int(CROP[0] * w), int(CROP[1] * h), int(CROP[2] * w), int(CROP[3] * h))
    im.crop(box).resize(((box[2] - box[0]) * 2, (box[3] - box[1]) * 2), Image.LANCZOS).save(
        f"/home/z/my-project/scripts/shots/{name}_crop.png"
    )
    print(f"{name}: {im.size} -> {box}")
