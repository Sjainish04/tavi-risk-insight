"""Smoke test the watsonx.ai connection.

Run from api/:
    uv run python scripts/test_watsonx.py
"""

from __future__ import annotations

import os
import sys

from dotenv import load_dotenv

load_dotenv()


def main() -> int:
    api_key = os.environ.get("WATSONX_API_KEY", "")
    project_id = os.environ.get("WATSONX_PROJECT_ID", "")
    url = os.environ.get("WATSONX_BASE_URL", "")
    model_id = os.environ.get("GRANITE_MODEL_ID", "ibm/granite-3-8b-instruct")

    print(f"Region:  {url}")
    print(f"Project: {project_id}")
    print(f"Model:   {model_id}")
    print(f"API key: {'set (len=' + str(len(api_key)) + ')' if api_key else 'MISSING'}")
    print("-" * 60)

    if not all((api_key, project_id, url)):
        print("Missing required env vars. Check api/.env.")
        return 1

    from ibm_watsonx_ai import Credentials
    from ibm_watsonx_ai.foundation_models import ModelInference

    creds = Credentials(url=url, api_key=api_key)
    try:
        model = ModelInference(model_id=model_id, credentials=creds, project_id=project_id)
        out = model.generate_text(
            prompt="In one sentence: why does aortic stenosis cause heart failure?",
            params={"max_new_tokens": 80, "decoding_method": "greedy"},
        )
        print("SUCCESS")
        print(f"Output: {out}")
        return 0
    except Exception as e:
        print(f"FAILED: {type(e).__name__}")
        msg = str(e)
        print(msg[:1000])
        return 2


if __name__ == "__main__":
    sys.exit(main())
