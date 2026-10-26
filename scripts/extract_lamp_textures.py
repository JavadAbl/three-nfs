#!/usr/bin/env python3
"""Extract lamp-relevant textures from the Audi + Viper GLBs so we can SEE
what detail exists for a texture-driven emissive glow (user: revert the flat
uniform glow on the Viper; the Audi's rear lights have the same flat look).

Dumps:
  - Audi TTRS_luz / TTRS_luz2 baseColorTextures (jpeg/png, raw bytes)
  - Viper dMAT_Lights_315 / emiss: emissiveMap AND baseColorTexture
"""
import json, struct, os

OUT = "/home/z/my-project/download/lamp_textures"
os.makedirs(OUT, exist_ok=True)

def glb_json_bin(path):
    data = open(path, "rb").read()
    off = 12
    js = bin_ = None
    while off < len(data):
        clen, ctype = struct.unpack("<II", data[off:off+8])
        chunk = data[off+8:off+8+clen]
        if ctype == struct.unpack("<I", b"JSON")[0]:
            js = json.loads(chunk)
        else:
            bin_ = chunk
        off += 8 + clen + (clen & 3)
    return js, bin_

def img_ext(mime):
    return "png" if "png" in mime else ("jpg" if "jpeg" in mime else "bin")

def dump_image(tag, js, bin_, image_idx):
    img = js["images"][image_idx]
    bv = js["bufferViews"][img["bufferView"]]
    raw = bin_[bv.get("byteOffset", 0): bv.get("byteOffset", 0) + bv["byteLength"]]
    ext = img_ext(img.get("mimeType", ""))
    path = f"{OUT}/{tag}.{ext}"
    open(path, "wb").write(raw)
    print(f"  {tag}: image#{image_idx} {img.get('mimeType')} {len(raw)}B -> {path}")
    return path

def tex_image_idx(js, tex):
    t = js["textures"][tex["index"]]
    # KHR_texture_basisu keeps the source nested in extensions
    if "source" in t:
        return t["source"]
    return t["extensions"]["KHR_texture_basisu"]["source"]

for glb, lamp_names in [
    ("public/models/audi-tt-rs-2010.glb", ["TTRS_luz", "TTRS_luz2"]),
    ("public/models/viper-srt10-2008.glb", ["dMAT_Lights_315"]),
    ("public/models/viper-acr-2016.glb", ["emiss"]),
]:
    js, bin_ = glb_json_bin(glb)
    car = os.path.basename(glb).replace(".glb", "")
    print(f"== {car} ==")
    for m in js["materials"]:
        if m["name"] not in lamp_names:
            continue
        pbr = m.get("pbrMetallicRoughness", {})
        base = pbr.get("baseColorTexture")
        emiss = m.get("emissiveTexture")
        if base:
            dump_image(f"{car}_{m['name']}_baseColor", js, bin_, tex_image_idx(js, base))
        if emiss:
            dump_image(f"{car}_{m['name']}_emissiveMap", js, bin_, tex_image_idx(js, emiss))
