"""Ollama (offline) fallback."""

from __future__ import annotations

import json
from collections.abc import AsyncIterator

import httpx

from tavi_api.config import get_settings


async def stream_ollama(prompt: str) -> AsyncIterator[str]:
    settings = get_settings()
    async with httpx.AsyncClient(timeout=60.0) as client:
        async with client.stream(
            "POST",
            f"{settings.ollama_base_url}/api/generate",
            json={"model": settings.ollama_model, "prompt": prompt, "stream": True},
        ) as resp:
            async for line in resp.aiter_lines():
                if not line.strip():
                    continue
                try:
                    obj = json.loads(line)
                except json.JSONDecodeError:
                    continue
                token = obj.get("response", "")
                if token:
                    yield token
                if obj.get("done"):
                    return
