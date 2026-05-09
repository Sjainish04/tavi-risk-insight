"""Health check endpoint."""

from __future__ import annotations

from fastapi import APIRouter, Request

from tavi_api import __version__
from tavi_api.config import get_settings
from tavi_api.schemas import HealthStatus

router = APIRouter()


@router.get("/healthz", response_model=HealthStatus)
async def healthz(request: Request) -> HealthStatus:
    settings = get_settings()
    model_loaded = bool(getattr(request.app.state, "risk_model", None))
    return HealthStatus(
        status="ok" if model_loaded else "degraded",
        version=__version__,
        model_loaded=model_loaded,
        llm_provider=settings.llm_provider,
        region=settings.watsonx_region,
        granite_model_id=settings.granite_model_id,
    )
