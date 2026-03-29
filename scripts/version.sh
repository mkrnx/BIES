#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# BIES Version Bump Script
#
# Usage:
#   ./scripts/version.sh patch      # 0.3.0 -> 0.3.1
#   ./scripts/version.sh minor      # 0.3.0 -> 0.4.0
#   ./scripts/version.sh major      # 0.3.0 -> 1.0.0
#   ./scripts/version.sh            # shows current version
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
VERSION_FILE="$ROOT_DIR/version.json"

# ─── Read current version ─────────────────────────────────────────────────────
CURRENT=$(grep -o '"version": *"[^"]*"' "$VERSION_FILE" | head -1 | cut -d'"' -f4)
if [ -z "$CURRENT" ]; then
  echo "Error: could not read version from $VERSION_FILE"
  exit 1
fi

# No argument → just print current version
if [ $# -eq 0 ]; then
  echo "$CURRENT"
  exit 0
fi

BUMP="$1"

# ─── Parse semver ─────────────────────────────────────────────────────────────
IFS='.' read -r MAJOR MINOR PATCH <<< "$CURRENT"

case "$BUMP" in
  major)
    MAJOR=$((MAJOR + 1))
    MINOR=0
    PATCH=0
    ;;
  minor)
    MINOR=$((MINOR + 1))
    PATCH=0
    ;;
  patch)
    PATCH=$((PATCH + 1))
    ;;
  *)
    echo "Usage: $0 [major|minor|patch]"
    exit 1
    ;;
esac

NEW_VERSION="$MAJOR.$MINOR.$PATCH"
echo "Bumping version: $CURRENT -> $NEW_VERSION"

# ─── Update version.json ─────────────────────────────────────────────────────
cat > "$VERSION_FILE" << EOF
{
  "version": "$NEW_VERSION"
}
EOF

# ─── Sync package.json files ─────────────────────────────────────────────────
for PKG in "$ROOT_DIR/package.json" "$ROOT_DIR/server/package.json"; do
  if [ -f "$PKG" ]; then
    # Use node for reliable JSON editing
    node -e "
      const fs = require('fs');
      const pkg = JSON.parse(fs.readFileSync('$PKG', 'utf8'));
      pkg.version = '$NEW_VERSION';
      fs.writeFileSync('$PKG', JSON.stringify(pkg, null, 2) + '\n');
    "
    echo "  Updated $(basename "$(dirname "$PKG")")/$(basename "$PKG")"
  fi
done

# ─── Generate changelog ──────────────────────────────────────────────────────
CHANGELOG="$ROOT_DIR/CHANGELOG.md"
PREV_TAG=$(git -C "$ROOT_DIR" tag --sort=-v:refname | head -1 2>/dev/null || true)
DATE=$(date +%Y-%m-%d)

# Build log range
if [ -n "$PREV_TAG" ]; then
  RANGE="$PREV_TAG..HEAD"
  echo "  Changelog: $PREV_TAG -> v$NEW_VERSION"
else
  RANGE="HEAD"
  echo "  Changelog: initial release (all commits)"
fi

# Categorize commits
FEATURES=$(git -C "$ROOT_DIR" log "$RANGE" --pretty=format:"- %s" --grep="^feat" 2>/dev/null || true)
FIXES=$(git -C "$ROOT_DIR" log "$RANGE" --pretty=format:"- %s" --grep="^fix" 2>/dev/null || true)
OTHER=$(git -C "$ROOT_DIR" log "$RANGE" --pretty=format:"%s" 2>/dev/null \
  | grep -v "^feat" | grep -v "^fix" | grep -v "^Merge" \
  | sed 's/^/- /' || true)

NEW_ENTRY="## [$NEW_VERSION] - $DATE"$'\n'

if [ -n "$FEATURES" ]; then
  NEW_ENTRY+=$'\n'"### Added"$'\n'"$FEATURES"$'\n'
fi
if [ -n "$FIXES" ]; then
  NEW_ENTRY+=$'\n'"### Fixed"$'\n'"$FIXES"$'\n'
fi
if [ -n "$OTHER" ]; then
  NEW_ENTRY+=$'\n'"### Changed"$'\n'"$OTHER"$'\n'
fi

if [ -f "$CHANGELOG" ]; then
  # Insert new entry after the header line
  HEADER=$(head -2 "$CHANGELOG")
  REST=$(tail -n +3 "$CHANGELOG")
  {
    echo "$HEADER"
    echo ""
    echo "$NEW_ENTRY"
    echo "$REST"
  } > "$CHANGELOG"
else
  {
    echo "# Changelog"
    echo ""
    echo "$NEW_ENTRY"
  } > "$CHANGELOG"
fi
echo "  Updated CHANGELOG.md"

# ─── Git commit + tag ─────────────────────────────────────────────────────────
git -C "$ROOT_DIR" add "$VERSION_FILE" "$CHANGELOG" \
  "$ROOT_DIR/package.json" "$ROOT_DIR/server/package.json"

git -C "$ROOT_DIR" commit -m "release: v$NEW_VERSION"
git -C "$ROOT_DIR" tag -a "v$NEW_VERSION" -m "Release v$NEW_VERSION"

echo ""
echo "Done! Tagged v$NEW_VERSION"
echo "Run 'git push && git push --tags' to publish."
