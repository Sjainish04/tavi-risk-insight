#!/usr/bin/env bash
# Deploy TAVI Risk Insight to IBM Code Engine.
#
# Prereqs (one-time):
#   ibmcloud login --sso
#   ibmcloud target -r us-south -g <YOUR_RESOURCE_GROUP>
#   ibmcloud plugin install code-engine container-registry
#
# Run from repo root:
#   ./deploy/deploy.sh
#
# The script is idempotent — re-running rebuilds + redeploys with new image versions.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
NAMESPACE="${IBM_CR_NAMESPACE:-tavi-hackathon}"
PROJECT="${IBM_CE_PROJECT:-tavi-risk}"
TAG="${IMAGE_TAG:-v$(date +%Y%m%d-%H%M)}"
REGION_DOMAIN="${IBM_REGION_DOMAIN:-us.icr.io}"

echo "==> Repo root:    $REPO_ROOT"
echo "==> Namespace:    $REGION_DOMAIN/$NAMESPACE"
echo "==> CE project:   $PROJECT"
echo "==> Image tag:    $TAG"
echo

# ---------- 0. Check ibmcloud login + target ----------
echo "==> Verifying ibmcloud session"
ibmcloud target | grep -q "us-south" || { echo "FAIL: target us-south first ('ibmcloud target -r us-south')"; exit 1; }
ibmcloud target | grep -q "Resource group:" || { echo "FAIL: target a resource group ('ibmcloud target -g <NAME>')"; exit 1; }
ibmcloud cr region-set us-south >/dev/null 2>&1 || true

# ---------- 1. Container Registry namespace ----------
echo "==> Ensuring CR namespace '$NAMESPACE'"
ibmcloud cr namespaces | grep -q "^$NAMESPACE" || ibmcloud cr namespace-add "$NAMESPACE"

# ---------- 2. Code Engine project ----------
echo "==> Ensuring Code Engine project '$PROJECT'"
ibmcloud ce project list 2>/dev/null | grep -q "^$PROJECT " \
  || ibmcloud ce project create --name "$PROJECT"
ibmcloud ce project select --name "$PROJECT"

# ---------- 2b. Registry binding so Code Engine can pull from ICR ----------
if ! ibmcloud ce registry get --name icr-secret >/dev/null 2>&1; then
  if [ -z "${ICR_API_KEY:-}" ]; then
    echo
    echo "FAIL: ICR registry binding 'icr-secret' missing and ICR_API_KEY not set."
    echo "  Mint an API key at https://cloud.ibm.com/iam/apikeys (or via:"
    echo "    ibmcloud iam api-key-create tavi-deploy -d 'TAVI deploy' --output json | jq -r .apikey )"
    echo "  Then re-run: ICR_API_KEY=<key> ./deploy/deploy.sh"
    exit 1
  fi
  echo "==> Creating registry secret 'icr-secret' for ICR access"
  ibmcloud ce registry create \
    --name icr-secret \
    --server "$REGION_DOMAIN" \
    --username iamapikey \
    --password "$ICR_API_KEY"
fi

# ---------- 3. Stage torch-hub cache for the brdav image ----------
echo "==> Staging torch-hub cache files into external/torch-hub-cache/"
HUB_DST="$REPO_ROOT/external/torch-hub-cache"
mkdir -p "$HUB_DST"
for f in rl_localizer_model.onnx regression_localizer_model.onnx model_swinvit.pt; do
  if [ ! -f "$HUB_DST/$f" ]; then
    cp -v "$HOME/.cache/torch/hub/checkpoints/$f" "$HUB_DST/$f"
  fi
done

# ---------- 4. Build images (in IBM's cloud, no local docker needed) ----------
echo "==> Building backend image"
ibmcloud cr build \
  -t "$REGION_DOMAIN/$NAMESPACE/backend:$TAG" \
  -f "$REPO_ROOT/api/Dockerfile" \
  "$REPO_ROOT/api"

echo "==> Building brdav inference image (heavyweight, ~600 MB artifacts)"
ibmcloud cr build \
  -t "$REGION_DOMAIN/$NAMESPACE/brdav:$TAG" \
  -f "$REPO_ROOT/external/tavr-server/Dockerfile" \
  "$REPO_ROOT/external"

echo "==> Building frontend image"
# We need the backend's public URL first to bake into VITE_API_URL.
# Deploy backend before frontend. For now use a placeholder; fixed in step 5.
BACKEND_URL_PLACEHOLDER="https://backend.placeholder"
ibmcloud cr build \
  -t "$REGION_DOMAIN/$NAMESPACE/frontend:$TAG" \
  -f "$REPO_ROOT/web/Dockerfile" \
  --build-arg "VITE_API_URL=$BACKEND_URL_PLACEHOLDER" \
  "$REPO_ROOT/web"

# ---------- 5. Secrets ----------
echo "==> Syncing CE secrets from api/.env"
SECRET_NAME="tavi-secrets"
# Recreate secret each deploy so rotation is automatic
ibmcloud ce secret delete --name "$SECRET_NAME" -f 2>/dev/null || true
ibmcloud ce secret create \
  --name "$SECRET_NAME" \
  --from-env-file "$REPO_ROOT/api/.env"

# ---------- 6. Deploy brdav (internal-only, project visibility) ----------
echo "==> Deploying brdav microservice (visibility=project, internal-only)"
ibmcloud ce app create --name tavi-brdav \
  --image "$REGION_DOMAIN/$NAMESPACE/brdav:$TAG" \
  --registry-secret icr-secret \
  --port 8001 \
  --cpu 1 --memory 4G \
  --min-scale 1 --max-scale 1 \
  --visibility project \
  --probe-ready type=tcp,port=8001 \
  --probe-ready-initial-delay 60 \
  2>/dev/null \
  || ibmcloud ce app update --name tavi-brdav \
       --image "$REGION_DOMAIN/$NAMESPACE/brdav:$TAG"

BRDAV_INTERNAL=$(ibmcloud ce app get --name tavi-brdav --output url)
# For app-to-app comms within a CE project, append /infer to the internal URL
echo "==> brdav internal URL: $BRDAV_INTERNAL"

# ---------- 7. Deploy backend ----------
echo "==> Deploying backend FastAPI"
ibmcloud ce app create --name tavi-backend \
  --image "$REGION_DOMAIN/$NAMESPACE/backend:$TAG" \
  --registry-secret icr-secret \
  --port 8000 \
  --cpu 1 --memory 2G \
  --min-scale 1 --max-scale 3 \
  --env BRDAV_URL="$BRDAV_INTERNAL/infer" \
  --env-from-secret "$SECRET_NAME" \
  --probe-ready type=http,path=/healthz,port=8000 \
  2>/dev/null \
  || ibmcloud ce app update --name tavi-backend \
       --image "$REGION_DOMAIN/$NAMESPACE/backend:$TAG" \
       --env BRDAV_URL="$BRDAV_INTERNAL/infer" \
       --env-from-secret "$SECRET_NAME"

BACKEND_URL=$(ibmcloud ce app get --name tavi-backend --output url)
echo "==> Backend public URL: $BACKEND_URL"

# ---------- 8. Rebuild + deploy frontend with the real BACKEND_URL ----------
echo "==> Rebuilding frontend with VITE_API_URL=$BACKEND_URL"
ibmcloud cr build \
  -t "$REGION_DOMAIN/$NAMESPACE/frontend:$TAG" \
  -f "$REPO_ROOT/web/Dockerfile" \
  --build-arg "VITE_API_URL=$BACKEND_URL" \
  "$REPO_ROOT/web"

ibmcloud ce app create --name tavi-frontend \
  --image "$REGION_DOMAIN/$NAMESPACE/frontend:$TAG" \
  --registry-secret icr-secret \
  --port 80 \
  --cpu 0.25 --memory 0.5G \
  --min-scale 0 --max-scale 2 \
  2>/dev/null \
  || ibmcloud ce app update --name tavi-frontend \
       --image "$REGION_DOMAIN/$NAMESPACE/frontend:$TAG"

FRONTEND_URL=$(ibmcloud ce app get --name tavi-frontend --output url)
echo
echo "================================================================"
echo "  Deploy complete."
echo "  Frontend: $FRONTEND_URL"
echo "  Backend:  $BACKEND_URL"
echo "  brdav:    $BRDAV_INTERNAL  (internal-only)"
echo "================================================================"
echo
echo "Next:"
echo "  - Update backend CORS_ORIGINS to include $FRONTEND_URL"
echo "    ibmcloud ce app update --name tavi-backend \\"
echo "      --env CORS_ORIGINS=$FRONTEND_URL,http://localhost:5173,http://localhost:5174"
