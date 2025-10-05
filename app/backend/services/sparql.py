# app/backend/services/sparql.py
import httpx
import time, json, os, threading
from pathlib import Path

from app.backend.config import get_settings
from app.backend.services.monitoring import record_fuseki_request

_client = httpx.Client(timeout=60.0)

def _ds() -> str:
    s = get_settings()
    return f"{s.fuseki_base_url}/{s.fuseki_dataset}"

# ---- Performance-Logging -----------------------------------------------------

_perf_lock = threading.Lock()
PERF_LOG = os.getenv("PERF_LOG_FILE", "app/backend/logs/perf.jsonl")
Path(os.path.dirname(PERF_LOG) or ".").mkdir(parents=True, exist_ok=True)

def _perf(kind: str, **kw):
    row = {
        "ts": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "kind": kind,
    }
    row.update(kw)
    with _perf_lock, open(PERF_LOG, "a", encoding="utf-8") as f:
        f.write(json.dumps(row, ensure_ascii=False) + "\n")

# ---- SELECT ------------------------------------------------------------------

def query_select(query: str) -> dict:
    s = get_settings()
    url = f"{_ds()}/sparql"
    t0 = time.perf_counter()

    r = _client.post(
        url,
        data={"query": query},
        headers={"Accept": "application/sparql-results+json"},
    )
    if r.status_code in (401, 403):
        r = _client.post(
            url,
            data={"query": query},
            headers={"Accept": "application/sparql-results+json"},
            auth=(s.fuseki_user, s.fuseki_password),
        )

    dt_s = time.perf_counter() - t0
    dt = dt_s * 1000.0
    status = r.status_code
    try:
        r.raise_for_status()
    finally:
        _perf("fuseki", op="select", status=status, dur_ms=round(dt, 1), bytes=len(query))
        record_fuseki_request("select", status, dt_s)

    return r.json()

# ---- UPDATE ------------------------------------------------------------------

def query_update(update: str) -> None:
    s = get_settings()
    url = f"{_ds()}/update"
    t0 = time.perf_counter()

    r = _client.post(url, data={"update": update}, auth=(s.fuseki_user, s.fuseki_password))

    dt_s = time.perf_counter() - t0
    dt = dt_s * 1000.0
    status = r.status_code
    try:
        r.raise_for_status()
    finally:
        _perf("fuseki", op="update", status=status, dur_ms=round(dt, 1), bytes=len(update))
        record_fuseki_request("update", status, dt_s)
