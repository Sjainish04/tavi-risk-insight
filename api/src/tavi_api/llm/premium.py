"""Premium fallback (OpenAI / Anthropic) — used only if env keys exist."""

from __future__ import annotations

from collections.abc import AsyncIterator

from loguru import logger

from tavi_api.config import get_settings


async def stream_premium(prompt: str) -> AsyncIterator[str]:
    settings = get_settings()
    if settings.openai_api_key:
        async for chunk in _stream_openai(prompt, settings.openai_api_key):
            yield chunk
        return
    if settings.anthropic_api_key:
        async for chunk in _stream_anthropic(prompt, settings.anthropic_api_key):
            yield chunk
        return
    yield "[error] no premium key configured."


async def _stream_openai(prompt: str, key: str) -> AsyncIterator[str]:
    from openai import AsyncOpenAI

    client = AsyncOpenAI(api_key=key)
    stream = await client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": prompt}],
        stream=True,
        max_tokens=400,
        temperature=0.2,
    )
    async for chunk in stream:
        delta = chunk.choices[0].delta.content
        if delta:
            yield delta


async def _stream_anthropic(prompt: str, key: str) -> AsyncIterator[str]:
    try:
        from anthropic import AsyncAnthropic
    except ImportError:
        logger.error("anthropic SDK not installed; install via `uv add anthropic`")
        yield "[error] anthropic SDK not installed."
        return

    client = AsyncAnthropic(api_key=key)
    async with client.messages.stream(
        model="claude-sonnet-4-6",
        max_tokens=400,
        messages=[{"role": "user", "content": prompt}],
    ) as stream:
        async for text in stream.text_stream:
            yield text
