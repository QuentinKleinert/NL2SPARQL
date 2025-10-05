from __future__ import annotations

import re
from prometheus_client import CollectorRegistry, Histogram, generate_latest

from app.backend.config import get_settings

_prometheus_registry: CollectorRegistry
_http_histogram: Histogram
_fuseki_histogram: Histogram


def _init_registry() -> None:
    global _prometheus_registry, _http_histogram, _fuseki_histogram
    _prometheus_registry = CollectorRegistry()
    _http_histogram = Histogram(
        "nl2sparql_http_request_duration_seconds",
        "HTTP request latency",
        labelnames=("method", "path", "status"),
        registry=_prometheus_registry,
    )
    _fuseki_histogram = Histogram(
        "nl2sparql_fuseki_request_duration_seconds",
        "Fuseki operation latency",
        labelnames=("operation", "status"),
        registry=_prometheus_registry,
    )


_init_registry()

_path_cleanup_re = re.compile(r"/([0-9a-fA-F-]{6,}|[0-9]{2,})")


def _metrics_enabled() -> bool:
    try:
        return bool(get_settings().enable_prometheus_metrics)
    except Exception:  # pragma: no cover - safety in case settings init fails
        return False


def record_http_request(method: str, path: str, status: int, duration_s: float) -> None:
    if not _metrics_enabled():
        return
    normalised_path = _path_cleanup_re.sub("/:id", path)
    _http_histogram.labels(method=method, path=normalised_path, status=str(status)).observe(duration_s)


def record_fuseki_request(operation: str, status: int, duration_s: float) -> None:
    if not _metrics_enabled():
        return
    _fuseki_histogram.labels(operation=operation, status=str(status)).observe(duration_s)


def prometheus_latest() -> bytes:
    return generate_latest(_prometheus_registry)


def reset_metrics_for_tests() -> None:  # pragma: no cover - used in tests
    _init_registry()


__all__ = [
    "record_http_request",
    "record_fuseki_request",
    "prometheus_latest",
    "reset_metrics_for_tests",
]
