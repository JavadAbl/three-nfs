#!/usr/bin/env bash
# ─── Car audio staging pipeline (idempotent) ────────────────────────────────
# Sources CC0/CC-BY game audio, processes into per-family rpm-layer OGGs
# and one-shots under public/audio/staging/ for in-game audition.
# Staging is gitignored and NOT service-worker cached → reload hears swaps.
set -uo pipefail

ROOT="/home/z/my-project"
DL="$ROOT/scripts/audio_dl"
OUT="$ROOT/public/audio/staging"
mkdir -p "$DL" "$OUT/engines/4cyl-turbo" "$OUT/engines/v6-tt" "$OUT/engines/v10"

log() { echo "[audio] $*"; }

dl() { # dl <url> <dest>
  local url="$1" dest="$2"
  if [ -s "$dest" ] && file "$dest" | grep -qvE "HTML|empty"; then return 0; fi
  curl -sL --retry 3 --max-time 120 -o "$dest" "$url"
  if file "$dest" | grep -q "HTML\|cannot open"; then log "WARN download failed: $dest ($url)"; return 1; fi
}

# ── 1. sources ──────────────────────────────────────────────────────────────
OGA="https://opengameart.org/sites/default/files"
for i in 0 1 2 3 4 5; do dl "$OGA/loop_$i.wav" "$DL/oga_loop_$i.wav"; done                       # CC0  domasx2 racing engine pitch ladder
dl "$OGA/engine-loop.7z"    "$DL/engine-loop.7z"                                                # CC-BY3.0 qubodup real 4-cyl loop
dl "$OGA/genericv8sound.zip" "$DL/genericv8.zip"                                                 # CC-BY-SA4.0 DerMeehdrescher V8
dl "$OGA/tires_squal_loop.wav" "$DL/tires_squal_loop.wav"                                        # CC-BY3.0 audible-edge skid loop
dl "$OGA/stunt-rally-sounds.zip" "$DL/stunt_rally.zip"                                           # CC-BY-SA3.0 Stunt Rally (boost, terrain)
dl "https://kenney.nl/media/pages/assets/impact-sounds/87b4ddecda-1677589768/kenney_impact-sounds.zip" "$DL/kenney_impact.zip"  # CC0 Kenney

# extract archives (rebuild dirs each run — cheap + idempotent)
[ -d "$DL/engine-loop" ] || python3 -c "
import py7zr,sys
with py7zr.SevenZipFile('$DL/engine-loop.7z') as z: z.extractall('$DL/engine-loop')" 2>/dev/null || log "WARN 7z extract engine-loop"
[ -d "$DL/kenney_impact" ] || { mkdir -p "$DL/kenney_impact"; unzip -o -q "$DL/kenney_impact.zip" -d "$DL/kenney_impact"; }
[ -d "$DL/stunt_rally" ] || { mkdir -p "$DL/stunt_rally"; unzip -o -q "$DL/stunt_rally.zip" -d "$DL/stunt_rally"; }
[ -d "$DL/v8" ] || { mkdir -p "$DL/v8"; unzip -o -q "$DL/genericv8.zip" -d "$DL/v8"; }

V8SRC=$(find "$DL/v8" -name "*.wav" | grep -iE "accel" | head -1)
[ -z "$V8SRC" ] && V8SRC=$(find "$DL/v8" -name "*.wav" | head -1)
V6SRC=$(find "$DL/engine-loop" -name "*normalized*.wav" | grep -v 96000 | head -1)
[ -z "$V6SRC" ] && V6SRC=$(find "$DL/engine-loop" -name "*.wav" | head -1)
log "V8 base: ${V8SRC##*/} | V6 base: ${V6SRC##*/}"
[ -z "$V8SRC" ] || [ -z "$V6SRC" ] && { log "FATAL missing engine base loops"; exit 1; }

# ── 2. rpm-ladder processing ─────────────────────────────────────────────────
# engine: pitch+tempo shift together (real engines rise both ways)
proc() { # proc <src> <rate> <dest.ogg>
  ffmpeg -hide_banner -loglevel error -y -i "$1" \
    -af "asetrate=44100*$2,aresample=44100,loudnorm=I=-16:TP=-2:LRA=9" \
    -ac 1 -c:a libvorbis -q:a 4 "$3"
}

# 4cyl-turbo: domasx2's 6 CC0 loops ARE a pitch ladder; order them by
# spectral centroid (numpy FFT) so idle→high is real, not guessed
python3 - << 'PYEOF' > "$DL/oga_order.txt"
import wave, struct, numpy as np
cents = []
for i in range(6):
    p = f"/home/z/my-project/scripts/audio_dl/oga_loop_{i}.wav"
    try:
        w = wave.open(p); n = min(w.getnframes(), 44100)
        d = np.frombuffer(w.readframes(n), dtype=np.int16).astype(np.float64)
        if w.getnchannels() == 2: d = d.reshape(-1, 2).mean(1)
        w.close()
        sp = np.abs(np.fft.rfft(d * np.hanning(len(d))))
        fr = np.fft.rfftfreq(len(d), 1 / 44100)
        cents.append((float((sp * fr).sum() / sp.sum()), i))
    except Exception as e:
        print(f"WARN loop_{i}: {e}"); cents.append((0, i))
print(" ".join(str(i) for _, i in sorted(cents)))
PYEOF
ORDER=$(cat "$DL/oga_order.txt" | tail -1)
log "oga pitch order (idle→high): $ORDER"
read -r -a O <<< "$ORDER"
[ ${#O[@]} -lt 4 ] && O=(0 1 2 3 4 5)
proc "$DL/oga_loop_${O[0]}.wav" 0.92 "$OUT/engines/4cyl-turbo/idle.ogg"
proc "$DL/oga_loop_${O[2]}.wav" 0.96 "$OUT/engines/4cyl-turbo/low.ogg"
proc "$DL/oga_loop_${O[4]}.wav" 1.00 "$OUT/engines/4cyl-turbo/mid.ogg"
proc "$DL/oga_loop_${O[5]}.wav" 1.06 "$OUT/engines/4cyl-turbo/high.ogg"

# v6-tt: one real 4-cyl recording pitched down into a V6-ish ladder
proc "$V6SRC" 0.58 "$OUT/engines/v6-tt/idle.ogg"
proc "$V6SRC" 0.72 "$OUT/engines/v6-tt/low.ogg"
proc "$V6SRC" 0.86 "$OUT/engines/v6-tt/mid.ogg"
proc "$V6SRC" 1.02 "$OUT/engines/v6-tt/high.ogg"

# v10: V8 loop pitched/tuned into the Viper family (ACR shares, detuned later in code)
proc "$V8SRC" 0.60 "$OUT/engines/v10/idle.ogg"
proc "$V8SRC" 0.74 "$OUT/engines/v10/low.ogg"
proc "$V8SRC" 0.90 "$OUT/engines/v10/mid.ogg"
proc "$V8SRC" 1.08 "$OUT/engines/v10/high.ogg"

# ── 3. one-shots + support loops ─────────────────────────────────────────────
K="$DL/kenney_impact/Audio"
cp "$K/impactMetal_light_002.ogg"  "$OUT/shift.ogg"
cp "$K/impactMetal_light_000.ogg"  "$OUT/impact_light.ogg"
cp "$K/impactMetal_medium_000.ogg" "$OUT/impact_med.ogg"
cp "$K/impactMetal_heavy_000.ogg"  "$OUT/impact_heavy.ogg"

ffmpeg -hide_banner -loglevel error -y -i "$DL/tires_squal_loop.wav" \
  -af "atrim=0.2:4.4,afade=t=out:st=4.2:d=0.15,loudnorm=I=-17:TP=-2" \
  -ac 1 -c:a libvorbis -q:a 5 "$OUT/skid.ogg"

ffmpeg -hide_banner -loglevel error -y -i "$DL/stunt_rally/sounds/boost.wav" \
  -af "loudnorm=I=-15:TP=-1.5" -c:a libvorbis -q:a 5 "$OUT/boost.ogg"

TERR=$(ls "$DL/stunt_rally/sounds/"terrain*.wav 2>/dev/null | head -1)
ffmpeg -hide_banner -loglevel error -y -i "$TERR" \
  -af "aloop=loop=-1:size=200000,atrim=0:3.0,loudnorm=I=-20:TP=-2" \
  -ac 1 -c:a libvorbis -q:a 4 "$OUT/rumble.ogg"

# ── 4. credits manifest ──────────────────────────────────────────────────────
cat > "$OUT/CREDITS.md" << 'EOF'
# Staged car audio — sources & licenses (AUDITION ONLY, not committed)
## Engines
- `engines/4cyl-turbo/*` — "racing car engine sound loops" by domasx2, OpenGameArt,
  **CC0** (derived from public-domain pdsounds recording). Pitch ladder sorted by
  spectral centroid; slight rate tuning. Base for: Audi TT-RS.
- `engines/v6-tt/*` — "Car Engine Loop 96kHz" by qubodup (Ivan Drucker recording),
  OpenGameArt, **CC-BY 3.0** (attribution required). Pitched down into V6-ish
  ladder. Base for: Nissan GT-R R35.
- `engines/v10/*` — "Generic V8 Engine Sound" by DerMeehdrescher, OpenGameArt,
  **CC-BY-SA 4.0** (attribution + share-alike). Pitched into V10-ish ladder.
  Base for: Viper SRT-10 '08 + Viper ACR '16.
## One-shots / loops
- `impact_*.ogg`, `shift.ogg` — Kenney "Impact Sounds", kenney.nl, **CC0**.
- `skid.ogg` — "Car tire squeal skid loop" by audible-edge (Tom Haigh),
  OpenGameArt, **CC-BY 3.0** (attribution required).
- `boost.ogg`, `rumble.ogg` — Stunt Rally sound pack (various authors, via
  Calinou), OpenGameArt, **CC-BY-SA 3.0** (attribution + share-alike).
EOF

# ── 5. verify ────────────────────────────────────────────────────────────────
log "── staged tree ──"
find "$OUT" -type f | sort | while read -r f; do
  printf "%-58s %8d bytes\n" "${f#$ROOT/}" "$(stat -c%s "$f")"
done
TOTAL=$(du -sb "$OUT" | cut -f1)
log "total: $((TOTAL/1024)) KB"
BAD=$(find "$OUT" -name "*.ogg" -size -2k | wc -l)
log "suspiciously small oggs: $BAD"
[ "$BAD" -gt 0 ] && find "$OUT" -name "*.ogg" -size -2k
log "done"
