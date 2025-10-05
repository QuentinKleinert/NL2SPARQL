import asyncio
import os

from fastapi.testclient import TestClient

from app.backend.main import app
from app.backend.services.security import refresh_rate_limiter, reset_rate_limiter_for_tests
from app.backend.config import get_settings


def client() -> TestClient:
    return TestClient(app)


def test_requires_api_key(monkeypatch):
    monkeypatch.setenv("API_AUTH_TOKEN", "secure-token")
    get_settings.cache_clear()
    refresh_rate_limiter()
    with client() as c:
        resp = c.get("/metrics/perf")
        assert resp.status_code == 401
        resp_ok = c.get("/metrics/perf", headers={"x-api-key": "secure-token"})
        assert resp_ok.status_code == 200


def test_rate_limit(monkeypatch):
    monkeypatch.setenv("RATE_LIMIT_PER_MINUTE", "1")
    monkeypatch.setenv("RATE_LIMIT_BURST", "1")
    get_settings.cache_clear()
    refresh_rate_limiter()

    asyncio.run(reset_rate_limiter_for_tests())

    with client() as c:
        headers = {"x-api-key": get_settings().api_auth_token}
        first = c.get("/metrics/perf", headers=headers)
        assert first.status_code == 200
        second = c.get("/metrics/perf", headers=headers)
        assert second.status_code == 429
