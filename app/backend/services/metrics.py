from __future__ import annotations
import os, time, json, threading
from starlette.middleware.base import BaseHTTPMiddleware

_perf_lock = threading.Lock()
PERF_LOG = os.getenv("PERF_LOG_FILE", "app/backend/logs/perf.jsonl")

def _write_perf(d: dict):
    with _perf_lock, open(PERF_LOG, "a", encoding="utf-8") as f:
        f.write(json.dumps(d, ensure_ascii=False) + "\n")

class RequestTimingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        t0 = time.perf_counter()
        try:
            response = await call_next(request)
            status = response.status_code
            return response
        finally:
            dt = (time.perf_counter() - t0) * 1000.0
            _write_perf({
                "ts": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                "kind": "http",
                "path": request.url.path,
                "method": request.method,
                "status": status,
                "dur_ms": round(dt, 1),
            })
