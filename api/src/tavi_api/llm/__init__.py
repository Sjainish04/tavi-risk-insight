"""LLM provider dispatch for the explanation layer.

Provider order (controlled by `LLM_PROVIDER` env var):
    watsonx → featherless → huggingface → ollama → premium

Each provider exposes the same async generator interface:
    async def stream(prompt: str) -> AsyncIterator[str]
"""

from __future__ import annotations

from collections.abc import AsyncIterator

from loguru import logger

from tavi_api.config import get_settings


async def stream_explanation(prompt: str) -> AsyncIterator[str]:
    """Route to the configured provider; yield text chunks."""
    provider = get_settings().llm_provider
    logger.info(f"streaming explanation via provider={provider}")

    if provider == "watsonx":
        from tavi_api.llm.watsonx import stream_watsonx
        async for chunk in stream_watsonx(prompt):
            yield chunk
    elif provider == "featherless":
        from tavi_api.llm.featherless_client import stream_featherless
        async for chunk in stream_featherless(prompt):
            yield chunk
    elif provider == "huggingface":
        from tavi_api.llm.huggingface_client import stream_hf
        async for chunk in stream_hf(prompt):
            yield chunk
    elif provider == "ollama":
        from tavi_api.llm.ollama_client import stream_ollama
        async for chunk in stream_ollama(prompt):
            yield chunk
    elif provider == "premium":
        from tavi_api.llm.premium import stream_premium
        async for chunk in stream_premium(prompt):
            yield chunk
    else:
        # Mock fallback — useful for the first scaffold run before any keys are wired
        for word in _MOCK_EXPLANATION.split():
            yield word + " "


_MOCK_EXPLANATION = (
    "- Clinical risk picture: this patient sits in a low-to-intermediate risk band "
    "with preserved LV function and adequate renal reserve.\n"
    "- Calibration caveat: raw STS-PROM appears to under-predict 30-day mortality "
    "in this stratum based on contemporary TVT-registry evidence.\n"
    "- Heart Team consideration: frailty assessment (gait speed, EFT) and pre-procedural "
    "imaging review of annular calcification would refine the recommendation."
)
