"""Hugging Face Inference API fallback (free tier)."""

from __future__ import annotations

from collections.abc import AsyncIterator

from loguru import logger

from tavi_api.config import get_settings


async def stream_hf(prompt: str) -> AsyncIterator[str]:
    settings = get_settings()
    if not settings.hf_token:
        yield "[error] HF_TOKEN not set."
        return

    try:
        from huggingface_hub import AsyncInferenceClient
    except ImportError:
        yield "[error] huggingface_hub not installed."
        return

    client = AsyncInferenceClient(model=settings.hf_model, token=settings.hf_token)
    try:
        async for token in await client.text_generation(
            prompt=prompt,
            max_new_tokens=400,
            stream=True,
        ):
            yield token
    except Exception as exc:  # noqa: BLE001
        logger.error(f"HF inference failed: {exc}")
        yield f"[error] HF inference failed: {exc}"
