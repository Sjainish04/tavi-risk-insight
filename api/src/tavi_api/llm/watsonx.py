"""IBM watsonx.ai Granite + Granite Guardian streaming client."""

from __future__ import annotations

from collections.abc import AsyncIterator

from loguru import logger

from tavi_api.config import get_settings


async def stream_watsonx(prompt: str) -> AsyncIterator[str]:
    """Stream Granite-3-8B output; gate through Granite Guardian post-stream.

    For hackathon simplicity we collect the Granite stream, run a single
    Guardian classification call on the full text, and re-yield in chunks.
    A future iteration could classify per-chunk for true streaming guard.
    """
    settings = get_settings()
    if not settings.watsonx_api_key:
        yield "[error] watsonx not configured."
        return

    try:
        from ibm_watsonx_ai import APIClient, Credentials
        from ibm_watsonx_ai.foundation_models import ModelInference
    except ImportError:
        logger.error("ibm-watsonx-ai not installed; falling back to mock")
        yield "[error] ibm-watsonx-ai SDK not installed; run `uv sync`."
        return

    creds = Credentials(url=settings.watsonx_base_url, api_key=settings.watsonx_api_key)
    APIClient(credentials=creds)

    granite = ModelInference(
        model_id=settings.granite_model_id,
        credentials=creds,
        project_id=settings.watsonx_project_id,
    )

    # Collect full Granite output
    pieces: list[str] = []
    for chunk in granite.generate_text_stream(
        prompt=prompt,
        params={"max_new_tokens": 400, "temperature": 0.2, "decoding_method": "greedy"},
    ):
        pieces.append(chunk)
    full = "".join(pieces)

    # Guardian classification (best-effort)
    safe = True
    try:
        guardian = ModelInference(
            model_id=settings.granite_guardian_model_id,
            credentials=creds,
            project_id=settings.watsonx_project_id,
        )
        verdict = guardian.generate_text(
            prompt=f"Is the following clinically safe and free of harm/jailbreak/hallucination? Answer 'safe' or 'unsafe'.\n\n{full}",
            params={"max_new_tokens": 8, "decoding_method": "greedy"},
        )
        if "unsafe" in verdict.lower():
            safe = False
            logger.warning(f"Granite Guardian flagged response as unsafe; sanitizing")
    except Exception as exc:  # noqa: BLE001 — best-effort safety filter
        logger.warning(f"Granite Guardian unavailable: {exc}; passing through")

    if not safe:
        yield (
            "- Clinical risk picture: this case requires Heart Team review.\n"
            "- Calibration caveat: AI summary suppressed by safety filter.\n"
            "- Heart Team consideration: rely on raw model outputs above."
        )
        return

    # Re-yield in word-sized chunks for streaming UX
    for word in full.split():
        yield word + " "
