# Agent Rules — three-nfs

## 1. Sandbox Restart Recovery (USER RULE — highest priority)

If the sandbox environment has restarted and all or part of the project data is
missing or stale, the FIRST action is always:

```bash
cd /home/z/my-project
git fetch origin
git reset --hard origin/main   # remote is the single source of truth
bun install                    # restore node_modules if wiped
```

- The **remote repository is the single source of truth.** Never treat a stale
  local working tree, an old local branch, or local memory as authoritative.
- Before overwriting anything local, optionally `git stash -u` or note local-only
  files (worklog.md, download/, scripts/ are gitignored and may vanish) — but the
  remote decides the final state of all tracked files.
- If a restart wiped the repo entirely, re-clone from origin, then apply the same
  rule: remote first, always.
- After recovery, verify with `git status` (expect clean, in sync with
  origin/main) and re-run the dev server / services only after the tree matches
  the remote.

## 1b. Platform checkpoint sweeper (observed 2026-10-19)

The sandbox periodically auto-commits local state with UUID messages (e.g.
`c0dd2eac-7407…`), force-adding junk (.next/ caches, db/, dev.log) and
REWRITING .gitignore to a 2-line stub. These commits are local-only — but:

- **Before ANY push**, run `git log --oneline origin/main..HEAD`.
  If UUID-message (or otherwise non-human) commits are on top, drop them first:
  `git reset --mixed origin/main` (working files survive), `git restore .gitignore`,
  then re-stage only intended changes.
- **Restore .gitignore BEFORE starting the dev server after any relaunch.**
  A stubbed .gitignore doesn't just pollute commits — it OOM-bombs the app:
  Tailwind v4 oxide auto-scans every un-ignored path (incl. the 86MB upload/
  GLB pile), the CSS compile balloons >4GB RSS, the cgroup OOM-killer SIGKILLs
  the PostCSS worker, and Turbopack panics with "globals.css / unexpected end
  of file" → GET / 500 (observed 2026-10-22). Symptom-to-cause: instant 500s +
  /tmp/next-panic-*.log + dmesg "Killed process" = check .gitignore first.
  Also note: hibernation can roll back the LOCAL repo state (refs AND tree) to
  an older snapshot — always `git fetch` + compare BOTH directions before
  diagnosing anything as "lost"; the remote is the only truth.
- **Push soon after real work** — the remote is the only protection against both
  sandbox restarts and sweeper pollution.
- If the remote itself ever gets polluted (sweeper commits pushed), clean the
  history with a revert/rewrite commit ASAP, keeping the remote the source of
  truth.

## 2. Asset acceptance workflow (existing user rule, kept)

New models/assets are NOT committed until the user accepts them. Candidates go
to `public/models/staging/` etc. (gitignored) — the game loads them, git never
sees them until acceptance.

### 2b. ALWAYS compress accepted models BEFORE pushing (USER RULE — 2026-10-21)

Never commit or push raw uncompressed model files. The acceptance flow is:

**staging (raw, gitignored) → user accepts → compress → commit compressed → push.**

- Pipeline: `scripts/ktx_convert.js` (gltf-transform + KTX-Software in
  `scripts/ktx/`), KTX2/ETC1S per texture slot. Per-set quality knobs and the
  night/emissive two-pass exception are documented in the script header —
  read it, don't guess. Normals/metalRough may stay PNG (UASTC bloats, linear
  data risk).
- Raw originals stay in staging after compression (rollback + regeneration);
  compressed output is the only thing that enters `public/models/city/`.
- **Gate every accept-commit on all three checks:**
  1. Size — a city-set GLB lands ~2MB (compressed), not ~15MB (raw). If the
     committed file is MBs larger than its staging sibling's converted form,
     stop and investigate before pushing.
  2. `npx gltf-transform inspect <glb>` must list `KHR_texture_basisu` in
     extensionsRequired — PNG-decoded textures mean compression was skipped.
  3. Quick visual parity vs the staging original (numeric stats via
     `scripts/ktx_parity.js` or a same-frame preview A/B). Emissive slots are
     the artifact hotspot (window smearing at high emissiveIntensity).
- Why: the 2966d09 incident pushed 60MB of stale raw GLBs; b7507c8 fixed the
  city sets (31.7MB → 7.8MB downloads, ~6x less VRAM, faster first load).
  Every future accept must clear the same bar — no exceptions, no "just this
  once", regardless of which agent or session performs the acceptance.
- This rule lives in this file on the remote so it survives sandbox restarts.
