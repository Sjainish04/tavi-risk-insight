#!/usr/bin/env bash
# Prepare a clean directory ready to push to your HF Space `tavi-brdav`.
#
# Usage:
#   HF_USER=<your-hf-username> ./deploy/hf-spaces/prep-brdav-space.sh
#   (then cd /tmp/tavi-brdav-staged && git init / push to HF — see HF_DEPLOY.md)

set -euo pipefail

if [ -z "${HF_USER:-}" ]; then
  echo "FAIL: set HF_USER env var (your Hugging Face username)"
  exit 1
fi

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
STAGE="/tmp/tavi-brdav-staged"

echo "==> Repo root: $REPO_ROOT"
echo "==> HF user:   $HF_USER"
echo "==> Staging:   $STAGE"

rm -rf "$STAGE"
mkdir -p "$STAGE"

echo "==> Copying brdav source + cached models"
cp -r "$REPO_ROOT/external/tavr"        "$STAGE/tavr"
cp -r "$REPO_ROOT/external/tavr-cache"  "$STAGE/tavr-cache"
cp -r "$REPO_ROOT/external/tavr-server" "$STAGE/tavr-server"

echo "==> Promoting Dockerfile to Space root (HF expects it there)"
cp "$REPO_ROOT/external/tavr-server/Dockerfile" "$STAGE/Dockerfile"

echo "==> Staging torch-hub cache files (MONAI SwinViT + ONNX localizers)"
mkdir -p "$STAGE/torch-hub-cache"
for f in model_swinvit.pt rl_localizer_model.onnx regression_localizer_model.onnx; do
  if [ -f "$HOME/.cache/torch/hub/checkpoints/$f" ]; then
    cp -v "$HOME/.cache/torch/hub/checkpoints/$f" "$STAGE/torch-hub-cache/$f"
  else
    echo "FAIL: missing $f in ~/.cache/torch/hub/checkpoints/"
    echo "  Run the local brdav smoke test once first to populate it:"
    echo "  cd external/tavr && ../tavr-venv/bin/python -m tools.predict --tabular data/tabular_fictional.json --measurements data/measurements_fictional.json --model swin"
    exit 1
  fi
done

echo "==> Adding HF README with frontmatter"
cp "$REPO_ROOT/deploy/hf-spaces/brdav-README.md" "$STAGE/README.md"

echo "==> Drop nested .git from cloned brdav (would be staged as a submodule)"
rm -rf "$STAGE/tavr/.git"

echo "==> Drop the brdav docs PNG (HF rejects unprefixed binaries; not needed for inference)"
rm -f "$STAGE/tavr/docs/teaser.png"

echo "==> Setting up Git LFS .gitattributes (HF requires LFS for binaries + large files)"
cat > "$STAGE/.gitattributes" <<'EOF'
*.ckpt filter=lfs diff=lfs merge=lfs -text
*.pt   filter=lfs diff=lfs merge=lfs -text
*.onnx filter=lfs diff=lfs merge=lfs -text
*.npy  filter=lfs diff=lfs merge=lfs -text
EOF

echo
echo "================================================================"
echo "  brdav Space staging complete: $STAGE"
echo
echo "  Total size on disk:"
du -sh "$STAGE"
echo
echo "  Next steps (run from a NEW terminal):"
echo "    cd $STAGE"
echo "    git init -b main"
echo "    git lfs install"
echo "    git add ."
echo "    git commit -m 'Initial brdav Space'"
echo "    git remote add origin https://huggingface.co/spaces/$HF_USER/tavi-brdav"
echo "    git push -u origin main"
echo "    # When git asks for password, paste an HF write-access token from"
echo "    # https://huggingface.co/settings/tokens"
echo "================================================================"
