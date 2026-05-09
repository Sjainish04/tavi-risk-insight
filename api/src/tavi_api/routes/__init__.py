"""HTTP route registration."""

from fastapi import APIRouter

from tavi_api.routes.explain import router as explain_router
from tavi_api.routes.healthz import router as healthz_router
from tavi_api.routes.predict import router as predict_router

api_router = APIRouter()
api_router.include_router(healthz_router, tags=["health"])
api_router.include_router(predict_router, tags=["predict"])
api_router.include_router(explain_router, tags=["explain"])

__all__ = ["api_router"]
