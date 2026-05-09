# tavi-api

FastAPI backend for TAVI Risk Insight. Computes STS-PROM, EuroSCORE II, recalibrated risk, runs a LightGBM trained on a synthetic TAVI cohort, generates SHAP, and streams clinical explanations from IBM Granite (with Featherless / Hugging Face / ollama fallbacks).

## Quick start

```bash
# Install deps + create venv
uv sync

# Generate synthetic cohort + train baseline LightGBM
uv run tavi-train

# Run the API (dev)
uv run uvicorn tavi_api.main:app --reload --host 0.0.0.0 --port 8000
```

Then open `http://localhost:8000/healthz` and `http://localhost:8000/docs`.

## Provider switching

`LLM_PROVIDER` env var controls the `/explain` backend:

| Value | Backend | Free? |
|---|---|---|
| `watsonx` (default) | IBM Granite-3-8B + Granite Guardian via watsonx.ai (Sydney) | School ID |
| `featherless` | BioMistral-7B via Featherless AI | Hackathon credits |
| `huggingface` | BioMistral via HF Inference API | Free tier |
| `ollama` | llama3.1:8b on localhost | Local only |
| `premium` | OpenAI gpt-4o-mini or Anthropic Claude | If you have a key |
