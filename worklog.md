# three-nfs worklog (rebuilt after sandbox reset)

## Session state
- repo: JavadAbl/three-nfs, branch main, remote = local = d1c27df (in sync)
- dev server :3000 running (nohup), 200 OK; HDR sky asset 200 OK
- tsc baseline: exactly 3 pre-existing errors (2 in skills/, 1 RaceManager.ts:111)
- .gitignore carries an uncommitted sandbox stub (ignores skills/ + node_modules/ etc.) — DO NOT commit it; stash before merge, restore after
- worklog.md is NOT git-tracked — sandbox resets wipe it; rebuild from git log if missing

## Recent tasks (from git log)
- Task 17: minimap fix (d233c4e)
- Task 18: SPA '92 GLB full scene + day mode (a89d06a + 65c41aa)
- Task 19: HDR realistic sky, PolyHaven sunflowers_puresky_2k (b27693c)
- Task 20: lopsided sky fixed — sun alignment baked into HDR via scripts/hdr_remap.mjs, dropped 34° runtime tilt (8148f15); horizon seam fix (4e83d28)
- Task 21: day maps — car lights off: dark lens boxes, glow sprites/underglow/fill are night-only (d1c27df). User PAT was refreshed once (old one expired); token scrubbed from .git/config after push — next push may need a fresh PAT again.
- Q&A: renderer is WebGL2 (three 0.186.1 WebGLRenderer); advised staying on WebGL2 vs WebGPU for now.

## Dev notes
- sandbox snapshots can be stale — always git fetch + compare before working
- SwiftShader headless can't visually verify sky; use /skytest harness + user's real browser
- sw.js asset bucket version — bump if any public/ asset changes

---
Task ID: 22
Agent: main
Task: "does this game cache data?" — verify SW caching with headless 2-visit test

Work Log:
- Wrote scripts/sw_cache_test.sh: boots dev server, opens game in headless Chromium, polls SW state, reloads, measures transferSize per asset request.
- Result: SW "CONTROLLING", bucket nfs-assets-v1; visit 2 = 58 asset requests, 58 served from Cache Storage, 0 from network (0.0 MB).
- Conclusion: the ~25MB game assets (models/textures/HDR/decoders) ARE cached across visits. What re-downloads every visit is the app JS itself — Next DEV server serves chunks with no-cache headers (SW deliberately skips non-asset paths; caching dev chunks would break HMR).
- Sandbox note: dev server now needs `setsid nohup ... < /dev/null & disown` — plain nohup gets reaped between tool calls. Test script + browser run must share one Bash call.

Stage Summary:
- Caching works as designed. Remaining per-visit download = dev-mode JS bundles; fixed by production deploy (next build + next start gives hashed immutable chunks), not by SW changes.
