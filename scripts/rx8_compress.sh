#!/usr/bin/env bash
# rx8_compress.sh — acceptance compression for the Mazda RX-8 (per AGENTS.md 2b):
#   raw staging GLB → dedup → prune → ETC1S baseColor (normals stay PNG:
#   linear data risk + UASTC bloat) → Draco meshes → public/models/.
# Same pipeline/profile as m4_compress.sh (fleet profile: Draco + KTX2 basisu).
# toktx/ktx lives in scripts/ktx/bin (never committed; see .gitignore).
set -euo pipefail
cd "$(dirname "$0")/.."

SRC=public/models/staging/mazda-rx-8-nfsmw.glb
TMP=/tmp/rx8_compressed.glb
DST=public/models/mazda-rx-8-nfsmw.glb
export PATH="$PWD/scripts/ktx/bin:$PATH"

raw=$(stat -c%s "$SRC")
echo "raw staging: $((raw / 1024 / 1024)) MB ($raw bytes)"

# 1. dedup duplicate textures/materials/accessors (Sketchfab exports are
#    often full of copies)
npx gltf-transform dedup "$SRC" /tmp/rx8_dedup.glb
# 2. prune unreferenced nodes/properties
npx gltf-transform prune /tmp/rx8_dedup.glb /tmp/rx8_pruned.glb
# 3. ETC1S/KTX2 for baseColor slots only — normals/metalRough stay PNG
#    (default quality 128, RDO 1.25 — matches the fleet's texture look)
npx gltf-transform etc1s /tmp/rx8_pruned.glb "$TMP" --slots baseColor
# 4. Draco mesh compression (quantization defaults) — must be last, it
#    rewrites the binary buffers
npx gltf-transform draco "$TMP" "$DST"

final=$(stat -c%s "$DST")
echo "compressed: $((final / 1024 / 1024)) MB ($final bytes)"
echo "ratio: $(python3 -c "print(f'{$raw/$final:.1f}x')")"

# Gate 2: required extensions must announce Draco + basisu
echo "── extensionsRequired ──"
npx gltf-transform inspect "$DST" | grep -A 1 "extensionsRequired"
