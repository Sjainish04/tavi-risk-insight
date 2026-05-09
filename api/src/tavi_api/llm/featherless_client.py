"""Featherless AI fallback (IBM Granite + medical models via OpenAI-compatible API)."""

from __future__ import annotations

import re
from collections.abc import AsyncIterator

from loguru import logger
from openai import AsyncOpenAI

from tavi_api.config import get_settings
from tavi_api.llm.prompts import EXPLANATION_SYSTEM_PROMPT

# Strip Mistral / Granite chat-template artifacts that occasionally leak into output
_TAG_RE = re.compile(r"\[/?INST\]|<\|.*?\|>|<s>|</s>|<<SYS>>|<</SYS>>")


async def stream_featherless(prompt: str) -> AsyncIterator[str]:
    settings = get_settings()
    if not settings.featherless_api_key:
        logger.warning("FEATHERLESS_API_KEY not set; yielding error message")
        yield "[error] Featherless not configured."
        return

    # Many Featherless-hosted models (Mistral family especially) reject the
    # system role and require user/assistant alternation. Send the full prompt
    # as a single user message — works across Granite, BioMistral, Llama.
    messages = [{"role": "user", "content": prompt}]

    client = AsyncOpenAI(
        api_key=settings.featherless_api_key,
        base_url=settings.featherless_base_url,
    )
    try:
        stream = await client.chat.completions.create(
            model=settings.featherless_model,
            messages=messages,
            stream=True,
            max_tokens=260,
            temperature=0.2,
        )
        async for chunk in stream:
            # Featherless terminal chunks sometimes have empty choices array
            if not chunk.choices:
                continue
            delta = chunk.choices[0].delta.content
            if delta:
                cleaned = _TAG_RE.sub("", delta)
                if cleaned:
                    yield cleaned
    except Exception as exc:  # noqa: BLE001
        logger.error(f"Featherless inference failed: {exc}")
        yield f"[error] Featherless inference failed: {exc}"
