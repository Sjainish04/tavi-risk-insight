# Backend FastAPI image — Python 3.12 slim, uv-managed.
#
# Build context: api/ (this Dockerfile lives in the same dir).
# Build:  ibmcloud cr build -t us.icr.io/tavi-hackathon/backend:v1 ./api
# Run:    ibmcloud ce app create ... (see deploy/deploy.sh)

FROM python:3.12-slim AS builder
WORKDIR /app

# System libs LightGBM needs at runtime (libgomp = GNU OpenMP)
RUN apt-get update \
    && apt-get install -y --no-install-recommends libgomp1 \
    && rm -rf /var/lib/apt/lists/*

# uv for fast deterministic installs
COPY --from=ghcr.io/astral-sh/uv:0.10.0 /uv /usr/local/bin/uv

# Cache deps separately from app code
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project

# App code + model artifacts
COPY src ./src
COPY models ./models
COPY artifacts ./artifacts
# README is referenced by pyproject.toml ([project].readme); hatchling
# fails the editable build if it's missing. Any README content is fine.
COPY README.md ./

# Final install (project itself in editable mode points to src/)
RUN uv sync --frozen --no-dev

# ---------- runtime ----------
FROM python:3.12-slim
WORKDIR /app

# Runtime system libs (LightGBM, OpenMP)
RUN apt-get update \
    && apt-get install -y --no-install-recommends libgomp1 \
    && rm -rf /var/lib/apt/lists/*

# Copy only the venv + app — drops uv binary, build artifacts, etc.
COPY --from=builder /app/.venv /app/.venv
COPY --from=builder /app/src /app/src
COPY --from=builder /app/models /app/models
COPY --from=builder /app/artifacts /app/artifacts

ENV PATH="/app/.venv/bin:$PATH" \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    HOST=0.0.0.0 \
    PORT=8000

EXPOSE 8000

# In production no --reload; let Code Engine handle scaling
CMD ["uvicorn", "tavi_api.main:app", "--host", "0.0.0.0", "--port", "8000"]
