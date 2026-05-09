"""SSE /explain — streams a Heart-Team-grade clinical narrative from the LLM."""

from __future__ import annotations

from fastapi import APIRouter, Request
from slowapi import Limiter
from slowapi.util import get_remote_address
from sse_starlette.sse import EventSourceResponse

from tavi_api.config import get_settings
from tavi_api.llm import stream_explanation
from tavi_api.llm.prompts import (
    EXPLANATION_SYSTEM_PROMPT,
    build_explanation_user_prompt,
)
from tavi_api.schemas import ExplainRequest

router = APIRouter()
limiter = Limiter(key_func=get_remote_address)


@router.post("/explain")
@limiter.limit(get_settings().rate_limit_explain)
async def explain(payload: ExplainRequest, request: Request) -> EventSourceResponse:
    user_prompt = build_explanation_user_prompt(
        features=payload.features,
        sts_prom_raw=payload.sts_prom_raw,
        sts_prom_recalibrated=payload.sts_prom_recalibrated,
        euroscore_ii=payload.euroscore_ii,
        tvt=payload.tvt,
        lgbm_probability=payload.lgbm_probability,
        shap_top5=[s.model_dump() for s in payload.shap_top5],
        miscalibration_zone=payload.miscalibration_zone,
    )
    full_prompt = f"{EXPLANATION_SYSTEM_PROMPT}\n\n{user_prompt}"

    async def event_generator():
        async for chunk in stream_explanation(full_prompt):
            yield {"event": "token", "data": chunk}
        yield {"event": "done", "data": ""}

    return EventSourceResponse(event_generator())
