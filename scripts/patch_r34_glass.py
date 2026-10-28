#!/usr/bin/env python3
"""patch_r34_glass.py — teach the SHIPPED R34 GLB the window-glass policy.

JSON-ONLY edits, BIN chunk byte-identical (audi/carA/carB precedent).

Why (user rule 2026-10-28: "glasses never fit the selected color; black,
or see-through glass when the model has inside-car details"):
the GTA "Elegy" R34 ships TWO nested full-cabin window shells —
  [41] body.001_emzone_plasmase1_0  1.35x0.81x3.13 (inner, opaque black)
  [42] body.001_emzone_juoda1_0     1.40x0.97x3.04 (outer, opaque black)
Both render as dead matte panels (VLM 2026-10-28: "solid painted panels,
zero transparency") while seats/dash/carpet sit behind them (emzone_206_sedy1
= seat, _kili1 = carpet, _salo1 = cabin, _skyd1 = dash shield).

Edits:
1. NEW MATERIAL "juoda_glass" (deepcopy of "emzone_juoda1") + re-point ONLY
   the outer shell mesh [42] at it — the 4 small juoda meshes (2 mirror
   housings *_sidelight, bumper strip, arch bit) stay on opaque juoda.
   CarModelLoader's GLASS_MAT matches "juoda_glass" → finalizeGlass turns it
   into see-through dark glass (the R34 has interior witnesses).
2. DELETE the inner plasmase shell node [41] (splice from parent): a second
   stacked shell would quadruple the see-through layer count. Its 4 small
   trim meshes keep the plasmase material untouched.
"""
import copy, json, struct, sys

SRC = "/home/z/my-project/public/models/skyline-gtr-r34.glb"


def read_glb(path):
    with open(path, "rb") as f:
        magic, ver, total = struct.unpack("<4sII", f.read(12))
        assert magic == b"glTF", "not a GLB"
        chunks = []
        while True:
            hdr = f.read(8)
            if len(hdr) < 8:
                break
            clen, ctype = struct.unpack("<II", hdr)
            data = f.read(clen)
            if clen % 4:
                f.read(4 - (clen % 4))
            chunks.append((ctype, data))
    return chunks


def write_glb(path, chunks, js):
    js_bytes = json.dumps(js, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
    pad = (4 - len(js_bytes) % 4) % 4
    js_bytes += b" " * pad
    bin_chunk = next((c for t, c in chunks if t == struct.unpack("<I", b"BIN\x00")[0]), b"")
    bin_pad = (4 - len(bin_chunk) % 4) % 4
    bin_out = bin_chunk + b"\x00" * bin_pad
    total = 12 + 8 + len(js_bytes) + 8 + len(bin_out)
    with open(path, "wb") as f:
        f.write(struct.pack("<4sII", b"glTF", 2, total))
        f.write(struct.pack("<II", len(js_bytes), struct.unpack("<I", b"JSON")[0]))
        f.write(js_bytes)
        f.write(struct.pack("<II", len(bin_out), struct.unpack("<I", b"BIN\x00")[0]))
        f.write(bin_out)
    return total


if __name__ == "__main__":
    chunks = read_glb(SRC)
    js = json.loads(next(c for t, c in chunks if t == struct.unpack("<I", b"JSON")[0]).decode("utf-8"))
    nodes, meshes, mats = js["nodes"], js["meshes"], js["materials"]

    # ── 1. juoda_glass material ──
    juoda_idx = next((i for i, m in enumerate(mats) if m.get("name") == "emzone_juoda1"), None)
    assert juoda_idx is not None, "emzone_juoda1 material missing"
    glass = copy.deepcopy(mats[juoda_idx])
    glass["name"] = "juoda_glass"
    mats.append(glass)
    glass_idx = len(mats) - 1
    print(f"material 'juoda_glass' appended at index {glass_idx}")

    # ── 2. re-point the outer shell mesh's primitives ──
    shell_nodes = [i for i, n in enumerate(nodes) if n.get("name") == "body.001_emzone_juoda1_0"]
    assert len(shell_nodes) == 1, f"outer juoda shell: expected 1 node, got {len(shell_nodes)}"
    shell = nodes[shell_nodes[0]]
    mesh_idx = shell.get("mesh")
    assert mesh_idx is not None, "shell node has no mesh"
    swapped = 0
    for prim in meshes[mesh_idx].get("primitives", []):
        if prim.get("material") == juoda_idx:
            prim["material"] = glass_idx
            swapped += 1
    print(f"shell mesh {mesh_idx}: {swapped} primitive(s) re-pointed to juoda_glass")
    assert swapped >= 1, "no primitives re-pointed"

    # sanity: no OTHER node may share this mesh (instancing would re-tint trims)
    sharers = [i for i, n in enumerate(nodes) if n.get("mesh") == mesh_idx]
    assert sharers == shell_nodes, f"shell mesh shared by nodes {sharers}"

    # ── 3. delete the inner plasmase shell node ──
    inner_nodes = [i for i, n in enumerate(nodes) if n.get("name") == "body.001_emzone_plasmase1_0"]
    assert len(inner_nodes) == 1, f"inner plasmase shell: expected 1 node, got {len(inner_nodes)}"
    inner = inner_nodes[0]
    parents = [i for i, n in enumerate(nodes) if inner in n.get("children", [])]
    assert len(parents) == 1, f"plasmase shell parent count {len(parents)}"
    nodes[parents[0]]["children"].remove(inner)
    print(f"plasmase shell node {inner} spliced from parent {parents[0]}")

    # sanity: plasmase trim meshes still reference the material
    trims = sum(
        1
        for n in nodes
        if n.get("mesh") is not None
        and "emzone_plasmase1_0" in (n.get("name") or "")
        and n.get("name") != "body.001_emzone_plasmase1_0"
    )
    print(f"plasmase trim meshes kept: {trims}")

    total = write_glb(SRC, chunks, js)
    print(f"\npatched -> {SRC} ({total/1e6:.2f} MB)")
