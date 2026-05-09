"""Application configuration loaded from environment variables."""

from __future__ import annotations

from functools import lru_cache
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

LLMProvider = Literal["watsonx", "featherless", "huggingface", "ollama", "premium"]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # App
    api_host: str = "0.0.0.0"
    api_port: int = 8000
    log_level: str = "INFO"
    environment: str = "development"
    cors_origins: str = "http://localhost:5173,http://localhost:3000"
    rate_limit_explain: str = "10/minute"

    # LLM provider switch
    llm_provider: LLMProvider = "watsonx"

    # IBM watsonx.ai (Sydney au-syd)
    watsonx_api_key: str = ""
    watsonx_api_key_backup: str = ""
    watsonx_project_id: str = ""
    watsonx_region: str = "au-syd"
    watsonx_base_url: str = "https://au-syd.ml.cloud.ibm.com"
    granite_model_id: str = "ibm/granite-3-8b-instruct"
    granite_guardian_model_id: str = "ibm/granite-guardian-3-8b"
    granite_fallback_model_id: str = "ibm/granite-13b-instruct-v2"
    llama_fallback_model_id: str = "meta-llama/llama-3-3-70b-instruct"

    # Featherless AI
    featherless_api_key: str = ""
    featherless_base_url: str = "https://api.featherless.ai/v1"
    featherless_model: str = "BioMistral/BioMistral-7B"
    featherless_model_compare: str = "deepseek-ai/DeepSeek-V3"

    # Hugging Face
    hf_token: str = ""
    hf_model: str = "BioMistral/BioMistral-7B"

    # ollama (offline)
    ollama_base_url: str = "http://localhost:11434"
    ollama_model: str = "llama3.1:8b"

    # Premium (only if available)
    openai_api_key: str = ""
    anthropic_api_key: str = ""

    # IBM Cloud Key Protect (replaces HPCS)
    key_protect_instance_id: str = ""
    key_protect_api_key: str = ""
    key_protect_root_key_id: str = ""
    key_protect_base_url: str = "https://au-syd.kms.cloud.ibm.com"
    watsonx_api_key_encrypted: str = ""

    # Model artifacts
    model_dir: str = "models"
    data_dir: str = "data"

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
