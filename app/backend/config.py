from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field
from functools import lru_cache

class Settings(BaseSettings):
    # Fuseki
    fuseki_base_url: str = Field(..., alias="FUSEKI_BASE_URL")
    fuseki_dataset:  str = Field(..., alias="FUSEKI_DATASET")
    fuseki_user:     str = Field(..., alias="FUSEKI_USER")
    fuseki_password: str = Field(..., alias="FUSEKI_PASSWORD")

    # LLM
    openai_api_key:        str = Field(..., alias="OPENAI_API_KEY")
    llm_model:             str = Field("gpt-4.1-mini", alias="LLM_MODEL")
    llm_temperature:       float = Field(0.2, alias="LLM_TEMPERATURE")
    llm_max_output_tokens: int = Field(1200, alias="LLM_MAX_OUTPUT_TOKENS")

    changes_graph: str = Field("urn:nl2sparql:changes", alias="CHANGES_GRAPH")

    # Security & Monitoring
    api_auth_token: str = Field(..., alias="API_AUTH_TOKEN")
    rate_limit_per_minute: int = Field(120, alias="RATE_LIMIT_PER_MINUTE")
    rate_limit_burst: int = Field(30, alias="RATE_LIMIT_BURST")
    enable_prometheus_metrics: bool = Field(True, alias="ENABLE_PROMETHEUS_METRICS")

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",   
    )

@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
