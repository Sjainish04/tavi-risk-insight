#!/usr/bin/env bash
# Prepare a clean directory ready to push to your HF Space `tavi-backend`.

set -euo pipefail

if [ -z "${HF_USER:-}" ]; then
  echo "FAIL: set HF_USER env var (your Hugging Face username)"
  exit 1
fi

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
STAGE="/tmp/tavi-backend-staged"

echo "==> Repo root: $REPO_ROOT"
echo "==> HF user:   $HF_USER"
echo "==> Staging:   $STAGE"

rm -rf "$STAGE"
mkdir -p "$STAGE"

echo "==> Copying api/ contents as Space root (excluding venv + caches)"
# Use rsync to exclude dev cruft. cp -a would pull in .venv (1+ GB).
rsync -a \
  --exclude '.venv/' \
  --exclude '.uv/' \
  --exclude '__pycache__/' \
  --exclude '.pytest_cache/' \
  --exclude '.ruff_cache/' \
  --exclude '.mypy_cache/' \
  --exclude 'catboost_info/' \
  --exclude '.env' \
  --exclude '.env.*' \
  "$REPO_ROOT/api/" "$STAGE/"

echo "==> Adding HF README with frontmatter"
cp "$REPO_ROOT/deploy/hf-spaces/backend-README.md" "$STAGE/README.md"

echo "==> .gitattributes for any LFS-eligible artifacts"
cat > "$STAGE/.gitattributes" <<'EOF'
*.pkl     filter=lfs diff=lfs merge=lfs -text
*.parquet filter=lfs diff=lfs merge=lfs -text
EOF

echo
echo "================================================================"
echo "  backend Space staging complete: $STAGE"
echo
echo "  Total size on disk:"
du -sh "$STAGE"
echo
echo "  Next steps:"
echo "    cd $STAGE"
echo "    git init -b main"
echo "    git lfs install"
echo "    git add ."
echo "    git commit -m 'Initial backend Space'"
echo "    git remote add origin https://huggingface.co/spaces/$HF_USER/tavi-backend"
echo "    git push -u origin main"
echo "    # HF token at https://huggingface.co/settings/tokens (Type: Write)"
echo "================================================================"
