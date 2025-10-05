from fastapi.testclient import TestClient

from app.backend.main import app
from app.backend.config import get_settings
from app.backend.services.monitoring import reset_metrics_for_tests


def test_prometheus_endpoint_reports_metrics():
    reset_metrics_for_tests()
    headers = {"x-api-key": get_settings().api_auth_token}
    with TestClient(app) as c:
        r1 = c.get("/metrics/perf", headers=headers)
        assert r1.status_code == 200
        prom = c.get("/metrics/prometheus", headers=headers)
        assert prom.status_code == 200
        assert "nl2sparql_http_request_duration_seconds" in prom.text
