#!/usr/bin/env bash
set -euo pipefail

SEMVER="${SEMVER:-}"
if [[ -z "$SEMVER" ]]; then
  echo " SEMVER not set. Use one of:"
  echo "   npm run release:patch"
  echo "   npm run release:minor"
  echo "   npm run release:major"
  exit 1
fi

# 1) Safety checks
branch=$(git rev-parse --abbrev-ref HEAD)
if [[ "$branch" != "dev" ]]; then
  echo "✖ Releases can only be made from 'dev' (current: '$branch')."
  exit 1
fi

if ! git diff --quiet; then
  echo "✖ Working tree is not clean. Commit or stash changes first."
  exit 1
fi

git fetch origin

# Check that dev is not behind origin/dev
if ! git merge-base --is-ancestor dev origin/dev; then
  echo "✖ Local 'dev' is behind 'origin/dev'."
  echo "  Please: git pull --rebase origin dev"
  exit 1
fi

echo "All checks are passed."

# 2) Tests
echo "Running tests…"
npm test

# 3) Bump version (creates commit + tag)
echo "Bumping version ($SEMVER)…"
npm version "$SEMVER"

# Optional manual confirmation
if npm run --silent yesno; then
  echo "Confirmed release."
else
  echo "Release not confirmed. Rolling back last version commit + tag."
  # Rollback the version bump in a controlled way
  last_tag=$(git describe --tags --abbrev=0)
  git tag -d "$last_tag"
  git reset --hard HEAD~1
  exit 1
fi

# 4) Push dev + tags
echo "Pushing 'dev' and tags…"
git push origin dev
git push origin --tags

# 5) Merge into main
echo "Merging into 'main'…"
git checkout main
git merge --no-ff dev
git push origin main

# 6) Back to dev
git checkout dev

echo "Release complete!"
