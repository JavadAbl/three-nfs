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
- **Push soon after real work** — the remote is the only protection against both
  sandbox restarts and sweeper pollution.
- If the remote itself ever gets polluted (sweeper commits pushed), clean the
  history with a revert/rewrite commit ASAP, keeping the remote the source of
  truth.

## 2. Asset acceptance workflow (existing user rule, kept)

New models/assets are NOT committed until the user accepts them. Candidates go
to `public/models/staging/` etc. (gitignored) — the game loads them, git never
sees them until acceptance.
