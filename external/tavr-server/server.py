"""brdav inference microservice — runs in tavr-venv (Python 3.8).

Loads the Brüggemann 2024 Swin-UNETR checkpoint once at startup and exposes
synchronous inference over HTTP. The TAVI main API on :8000 calls this on
:8001 to fetch the 5th-opinion probability without paying ~10s of cold-start
on every /predict.
"""

from __future__ import annotations

import math
import sys
import time
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any, Dict, Optional

import pandas as pd
import torch
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

_HERE = Path(__file__).resolve().parent
_TAVR_REPO = _HERE.parent / "tavr"
_CHECKPOINT = _HERE.parent / "tavr-cache" / "tavr_swin_unetr_checkpoint.ckpt"

sys.path.insert(0, str(_TAVR_REPO))
from src.model import ProbabilisticModel  # noqa: E402

_MODEL: Optional[ProbabilisticModel] = None
_LOAD_TIME_S: Optional[float] = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _MODEL, _LOAD_TIME_S
    print(f"[brdav] loading checkpoint {_CHECKPOINT.name}", flush=True)
    t0 = time.perf_counter()
    _MODEL = ProbabilisticModel.load_from_checkpoint(str(_CHECKPOINT), map_location="cpu")
    _MODEL.eval()
    _LOAD_TIME_S = time.perf_counter() - t0
    print(f"[brdav] model ready in {_LOAD_TIME_S:.1f}s", flush=True)
    yield
    _MODEL = None


app = FastAPI(title="brdav-inference", version="0.1.0", lifespan=lifespan)


def _to_series(d: Dict[str, Any]) -> pd.Series:
    """JSON null → NaN; preserve booleans and floats so brdav's pd.Series path matches."""
    return pd.Series({k: (math.nan if v is None else v) for k, v in d.items()})


class InferRequest(BaseModel):
    tabular: Dict[str, Any]
    measurements: Dict[str, Any]


class InferResponse(BaseModel):
    probability: float
    took_ms: int


@app.get("/healthz")
def healthz() -> Dict[str, Any]:
    return {
        "status": "ok" if _MODEL is not None else "loading",
        "model_loaded": _MODEL is not None,
        "model_load_time_s": _LOAD_TIME_S,
        "checkpoint": _CHECKPOINT.name,
    }


@app.post("/infer", response_model=InferResponse)
def infer(req: InferRequest) -> InferResponse:
    if _MODEL is None:
        raise HTTPException(status_code=503, detail="model still loading")
    tabular = _to_series(req.tabular)
    measurements = _to_series(req.measurements)
    t0 = time.perf_counter()
    with torch.inference_mode():
        prediction, _ = _MODEL(image=None, tabular=tabular, measurements=measurements)
    elapsed_ms = int((time.perf_counter() - t0) * 1000)
    return InferResponse(probability=float(prediction.item()), took_ms=elapsed_ms)
