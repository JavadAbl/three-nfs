#!/usr/bin/env python3
"""Compare the REJECTED flat glow (lamp_after_fixed*.png, emissiveMap=null)
vs the NEW texture-modulated glow (viper08_*_2x.png) — same car, same map.

Metrics that capture "flat sticker" vs "lamp-shaped":
  - glowing pixel count + bounding-box area (sticker = covers whole housing)
  - internal gaps: dark/quiet pixels INSIDE the glow bounding box
    (texture-modulated glow has holes where the bake/color-map is dark;
     flat glow is a solid slab)
"""
from PIL import Image

def glow_stats(path, label, warm=False):
    im = Image.open(path).convert("RGB")
    w, h = im.size
    px = im.load()
    pts = []
    for y in range(h):
        for x in range(w):
            r, g, b = px[x, y]
            if warm:  # warm-white headlamp glow
                if r > 185 and g > 140 and b < 165 and r > b * 1.25:
                    pts.append((x, y))
            else:     # saturated red tail glow
                if r > 140 and r > g * 2.4 and r > b * 2.4:
                    pts.append((x, y))
    if not pts:
        print(f"{label:34s} no glow pixels")
        return
    xs = [p[0] for p in pts]; ys = [p[1] for p in pts]
    x0, x1, y0, y1 = min(xs), max(xs), min(ys), max(ys)
    bbox = (x1 - x0 + 1) * (y1 - y0 + 1)
    # dark gaps inside bbox (not part of glow)
    gaps = 0
    for y in range(y0, y1 + 1, 2):
        for x in range(x0, x1 + 1, 2):
            r, g, b = px[x, y]
            if not (r > 90 or g > 90 or b > 90):
                gaps += 1
    sampled = ((y1 - y0) // 2 + 1) * ((x1 - x0) // 2 + 1)
    print(f"{label:34s} glowpx={len(pts):5d} bbox={x1-x0+1}x{y1-y0+1} "
          f"bboxfill={len(pts)/bbox*100:4.1f}%  dark-gaps-in-bbox={gaps*100//max(sampled,1)}%")

print("== REJECTED flat state (evidence PNGs) ==")
glow_stats("public/lamp_after_fixed.png", "rejected: tail (chase)")
glow_stats("public/lamp_after_fixed_zoom.png", "rejected: head zoom", warm=True)
print("== NEW texture-modulated state ==")
glow_stats("download/viper08_rear_2x.png", "new: tail (chase 2x)")
glow_stats("download/viper08_front_2x.png", "new: head (front 2x)", warm=True)
glow_stats("download/viper08_rear_2x_crop.png", "new: tail crop", )
