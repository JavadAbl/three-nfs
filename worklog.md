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
