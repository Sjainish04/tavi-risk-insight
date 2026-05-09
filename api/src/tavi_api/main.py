"""FastAPI entry point for TAVI Risk Insight."""

from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from loguru import logger
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from tavi_api import __version__
from tavi_api.config import get_settings
from tavi_api.model import load_model
from tavi_api.model.infer import load_stacking_model
from tavi_api.routes import api_router
from tavi_api.routes.explain import limiter


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    logger.info(f"starting tavi-api v{__version__}  provider={settings.llm_provider}  region={settings.watsonx_region}")
    try:
        app.state.risk_model = load_model(settings.model_dir)
        logger.success(f"loaded LightGBM (AUROC={app.state.risk_model.metadata.get('test_auroc', 'n/a'):.3f})")
    except FileNotFoundError:
        logger.warning("LightGBM artifacts not found — run `uv run tavi-train` to create them. /predict will return 503 until then.")
        app.state.risk_model = None

    # v3 stacking (winner among local model variants). Optional — if not present,
    # /predict falls back to v1 LGBM. Train via scripts/train_model_variants.py.
    app.state.stacking_model = load_stacking_model(settings.model_dir)
    if app.state.stacking_model is not None:
        logger.success("loaded v3 stacking ensemble (LGBM + CatBoost + LR, brdav-aware)")
    else:
        logger.info("v3 stacking artifacts not found — /predict will use v1 LightGBM")

    yield
    logger.info("tavi-api shutting down")


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title="TAVI Risk Insight API",
        version=__version__,
        description="Calibration-drift-aware TAVI risk prediction for the IBM Z × UNSA Sheridan Hackathon.",
        lifespan=lifespan,
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
    app.include_router(api_router)

    @app.get("/")
    async def root() -> dict[str, str]:
        return {
            "service": "tavi-api",
            "version": __version__,
            "docs": "/docs",
            "health": "/healthz",
        }

    return app


app = create_app()
