# brdav inference microservice — Python 3.8 (matches Brüggemann 2024's lightning 2.0).
#
# Build context: external/
# Build:  ibmcloud cr build -t us.icr.io/tavi-hackathon/brdav:v1 \
#           -f external/tavr-server/Dockerfile ./external
#
# The image bakes the Brüggemann checkpoint (144 MB), MONAI SwinViT backbone (411 MB),
# and ONNX localizers (51 MB) so cold-start in Code Engine is fast (~3-5 s).

FROM python:3.8-slim
WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends libgomp1 \
    && rm -rf /var/lib/apt/lists/*

# Install brdav requirements (already patched: onnxruntime-gpu -> onnxruntime)
COPY tavr/requirements.txt /tmp/brdav-reqs.txt
RUN pip install --no-cache-dir -r /tmp/brdav-reqs.txt \
    && pip install --no-cache-dir "fastapi>=0.100" "uvicorn[standard]>=0.30"

# Layout that server.py expects:
#   /app/tavr/         - brdav repo source (so `from src.model` resolves)
#   /app/tavr-cache/   - the Swin checkpoint
#   /app/tavr-server/  - server.py (working dir)
COPY tavr            /app/tavr
COPY tavr-cache      /app/tavr-cache
COPY tavr-server     /app/tavr-server

# Pre-place ONNX localizers + MONAI SwinViT backbone in torch.hub cache so the
# brdav model loads offline. These files are pulled by the deploy script from
# ~/.cache/torch/hub/checkpoints/ into ./torch-hub-cache/ before the build.
COPY torch-hub-cache /root/.cache/torch/hub/checkpoints

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

WORKDIR /app/tavr-server
EXPOSE 8001

CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8001"]
