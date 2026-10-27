#!/usr/bin/env python3
"""Process ambientCG 1K-JPG zips into repo-norm PBR trios under
public/textures/props/<name>/ (1k-color.jpg / 1k-normal.jpg / 1k-rough.jpg).
Also builds a labelled contact sheet of the color maps for visual review."""
import os
from PIL import Image, ImageDraw

SRC = "/home/z/my-project/upload/extracted"
DST = "/home/z/my-project/public/textures/props"

SETS = {
    "Rock063": "rock063",
    "Bark013": "bark013",
    "Moss004": "moss004",
    "Moss003": "moss003",
    "Rock057": "rock057",
}

thumbs = []
for src_name, dst_name in SETS.items():
    folder = os.path.join(SRC, f"{src_name}_1K-JPG")
    out_dir = os.path.join(DST, dst_name)
    os.makedirs(out_dir, exist_ok=True)
    trio = []
    for kind, suffix in [("Color", "color"), ("NormalGL", "normal"), ("Roughness", "rough")]:
        im = Image.open(os.path.join(folder, f"{src_name}_1K-JPG_{kind}.jpg")).convert("RGB")
        # normal/rough: keep crisp, high quality; color: q80 like the rest of the repo
        q = 92 if kind != "Color" else 80
        out = os.path.join(out_dir, f"1k-{suffix}.jpg")
        im.save(out, "JPEG", quality=q, optimize=True)
        trio.append(out)
        print(f"{dst_name}/1k-{suffix}.jpg  {im.size}  {os.path.getsize(out)//1024} KB")
    # 256px labelled thumb for the contact sheet
    th = Image.open(trio[0])
    th.thumbnail((320, 320))
    thumbs.append((dst_name, th))

# contact sheet
W = max(t.width for _, t in thumbs) + 20
H = sum(t.height + 34 for _, t in thumbs) + 10
sheet = Image.new("RGB", (W, H), (24, 24, 28))
d = ImageDraw.Draw(sheet)
y = 6
for name, th in thumbs:
    d.text((12, y + 2), name, fill=(255, 255, 255))
    sheet.paste(th, (10, y + 22))
    y += th.height + 34
sheet.save("/home/z/my-project/scripts/tex_sheet.jpg", "JPEG", quality=85)
print("sheet -> scripts/tex_sheet.jpg")
