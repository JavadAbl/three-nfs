#!/usr/bin/env bash
# Sandbox-recycle recovery — remote repo is the single source of truth (AGENTS.md rule 1).
# Symptoms it fixes: app not running / serving old code (stale checkpoint) / 500 font errors.
set -e
cd /home/z/my-project

echo ">> fetch remote"
git fetch origin -q || echo "!! fetch failed (offline?) — continuing with last known origin/main"

# protect unpushed local commits BEFORE the hard reset (git credentials may
# be expired — reset --hard would otherwise throw away real work)
AHEAD=$(git rev-list --count origin/main..HEAD 2>/dev/null || echo 0)
if [ "$AHEAD" -gt 0 ]; then
  if GIT_TERMINAL_PROMPT=0 git push origin main 2>/dev/null; then
    echo ">> pushed $AHEAD pending commit(s)"
    AHEAD=0
  else
    git branch -f pending-unpushed
    echo "!! push failed — $AHEAD unpushed commit(s) preserved on branch 'pending-unpushed'"
  fi
fi

# drop platform checkpoint-sweeper commits (UUID messages) — rule 1b
if git log --format=%s origin/main..HEAD | grep -qE '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'; then
  echo ">> dropping sweeper commits (rule 1b)"
  git reset --mixed origin/main
  git restore .gitignore 2>/dev/null || true
fi

echo ">> sync to origin/main"
git reset --hard origin/main

# re-apply preserved real work (branch created above when push failed)
if git show-ref --verify --quiet refs/heads/pending-unpushed; then
  PENDING=$(git rev-list --count origin/main..pending-unpushed 2>/dev/null || echo 0)
  if [ "$PENDING" -gt 0 ]; then
    echo ">> re-applying $PENDING unpushed commit(s) from 'pending-unpushed'"
    git cherry-pick pending-unpushed 2>/dev/null \
      || echo "!! cherry-pick failed — commits safe on branch 'pending-unpushed'"
  fi
fi

echo ">> restore deps"
bun install

echo ">> restart dev server (daemonized, survives tool calls)"
ps aux | grep -E 'next dev|next-server|dev/build/postcss' | grep -v grep \
  | awk '{print $2}' | xargs -r kill 2>/dev/null || true
sleep 2
rm -rf .next
( setsid bash -c 'exec ./node_modules/.bin/next dev -p 3000 > /home/z/my-project/dev.log 2>&1' \
  < /dev/null > /dev/null 2>&1 & )
sleep 14

echo ">> health"
curl -s -o /dev/null -w "app: %{http_code}\n" --max-time 30 http://localhost:3000
git log --oneline -1
echo ">> done"
