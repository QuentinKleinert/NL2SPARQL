from __future__ import annotations

import json
import os
import threading
import time

from starlette.middleware.base import BaseHTTPMiddleware

from app.backend.services.monitoring import record_http_request

_perf_lock = threading.Lock()
PERF_LOG = os.getenv("PERF_LOG_FILE", "app/backend/logs/perf.jsonl")

def _write_perf(d: dict):
    with _perf_lock, open(PERF_LOG, "a", encoding="utf-8") as f:
        f.write(json.dumps(d, ensure_ascii=False) + "\n")

class RequestTimingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        t0 = time.perf_counter()
        status_code = 500
        try:
            response = await call_next(request)
            status_code = response.status_code
            return response
        finally:
            dt = time.perf_counter() - t0
            duration_ms = round(dt * 1000.0, 1)
            payload = {
                "ts": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                "kind": "http",
                "path": request.url.path,
                "method": request.method,
                "status": status_code,
                "dur_ms": duration_ms,
            }
            _write_perf(payload)
            record_http_request(request.method, request.url.path, status_code, dt)
