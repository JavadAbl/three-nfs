#!/usr/bin/env python3
"""Crop headlight region from garage screenshots for VLM close-up analysis."""
from PIL import Image

# camera (5.6,2.3,6.8) → we see the car's front-right 3/4 view; nose points
# screen-left. Headlights sit left-of-center of the car body.
CROP = (0.18, 0.30, 0.62, 0.72)  # x0,y0,x1,y1 fractions

for name in ["car1", "car_audi", "car_viper08", "car_viper16"]:
    im = Image.open(f"/home/z/my-project/scripts/{name}.png")
    w, h = im.size
    box = (int(CROP[0] * w), int(CROP[1] * h), int(CROP[2] * w), int(CROP[3] * h))
    im.crop(box).resize(((box[2]-box[0])*2, (box[3]-box[1])*2), Image.LANCZOS).save(
        f"/home/z/my-project/scripts/{name}_crop.png"
    )
    print(f"{name}: {im.size} → crop {box}")
