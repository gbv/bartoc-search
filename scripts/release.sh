#!/usr/bin/env bash
set -euo pipefail

SEMVER="${SEMVER:-}"
if [[ ! "$SEMVER" =~ ^(patch|minor|major)$ ]]; then
  echo "SEMVER must be one of: patch, minor, major"
  echo "Use: npm run release:patch | release:minor | release:major"
  exit 1
fi

branch=$(git rev-parse --abbrev-ref HEAD)
if [[ "$branch" != "dev" ]]; then
  echo "✖ Releases can only be made from 'dev' (current: '$branch')."
  exit 1
fi

if [[ -n "$(git status --porcelain)" ]]; then
  echo "✖ Working tree is not clean. Commit or stash changes first."
  exit 1
fi

git fetch origin

if ! git merge-base --is-ancestor origin/dev dev; then
  echo "✖ Local 'dev' is behind 'origin/dev'."
  echo "  Please: git pull --rebase origin dev"
  exit 1
fi

if [[ "$(git rev-parse main)" != "$(git rev-parse origin/main)" ]]; then
  echo "✖ Local 'main' must match 'origin/main'."
  echo "  Please: git checkout main && git pull --ff-only origin main && git checkout dev"
  exit 1
fi

if ! git merge-base --is-ancestor main dev; then
  echo "✖ 'main' is not an ancestor of 'dev'."
  echo "  Please merge or rebase 'main' into 'dev' before releasing."
  exit 1
fi

echo "Running tests…"
npm test

echo "Bumping version ($SEMVER)…"
tag=$(npm version "$SEMVER")

if npm run --silent yesno; then
  echo "Confirmed release."
else
  echo "Release not confirmed. Rolling back last version commit + tag."
  git tag -d "$tag"
  git reset --hard HEAD~1
  exit 1
fi

echo "Fast-forwarding 'main'…"
git checkout main
git merge --ff-only dev

echo "Pushing 'dev', 'main', and '$tag'…"
git push --atomic origin dev main "$tag"

git checkout dev

echo "Release complete!"
