import os
import pytest

from app.backend.config import get_settings
from app.backend.services.security import refresh_rate_limiter


@pytest.fixture(autouse=True)
def _configure_env(monkeypatch):
    monkeypatch.setenv("FUSEKI_BASE_URL", "http://example.org")
    monkeypatch.setenv("FUSEKI_DATASET", "test")
    monkeypatch.setenv("FUSEKI_USER", "user")
    monkeypatch.setenv("FUSEKI_PASSWORD", "pass")
    monkeypatch.setenv("OPENAI_API_KEY", "sk-test")
    monkeypatch.setenv("CHANGES_GRAPH", "urn:test:changes")
    monkeypatch.setenv("API_AUTH_TOKEN", "test-token")
    monkeypatch.setenv("RATE_LIMIT_PER_MINUTE", "5")
    monkeypatch.setenv("RATE_LIMIT_BURST", "2")
    monkeypatch.setenv("ENABLE_PROMETHEUS_METRICS", "1")
    get_settings.cache_clear()
    refresh_rate_limiter()
    yield
    get_settings.cache_clear()
