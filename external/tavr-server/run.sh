#!/usr/bin/env bash
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$HERE"
exec ../tavr-venv/bin/uvicorn server:app --host 127.0.0.1 --port 8001 --log-level info
