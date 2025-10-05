# app/backend/routers/metrics.py
from collections import Counter
import datetime
import json
import os
import time

from fastapi import APIRouter, Query, Depends
from fastapi.responses import Response
from prometheus_client import CONTENT_TYPE_LATEST

from app.backend.services.monitoring import prometheus_latest
from app.backend.services.security import rate_limit_dependency

router = APIRouter(
    prefix="/metrics",
    tags=["metrics"],
    dependencies=[Depends(rate_limit_dependency)],
)

PERF_FILE = os.getenv("PERF_LOG_FILE", "app/backend/logs/perf.jsonl")

def _read_rows(minutes: int):
    cutoff = time.time() - minutes * 60
    rows = []
    if not os.path.exists(PERF_FILE):
        return rows
    with open(PERF_FILE, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                row = json.loads(line)
            except Exception:
                continue
            ts = row.get("ts")
            try:
                t = datetime.datetime.strptime(ts, "%Y-%m-%dT%H:%M:%SZ").replace(
                    tzinfo=datetime.timezone.utc
                ).timestamp()
            except Exception:
                continue
            if t >= cutoff:
                rows.append(row)
    return rows

def _stats(durs):
    if not durs:
        return {"n": 0, "p50_ms": 0, "p95_ms": 0, "max_ms": 0}
    d = sorted(durs)
    def pct(p: float):
        k = (len(d) - 1) * p
        i = int(k)
        j = min(i + 1, len(d) - 1)
        val = d[i] if i == j else d[i] + (d[j] - d[i]) * (k - i)
        return round(val, 1)
    return {
        "n": len(d),
        "p50_ms": pct(0.50),
        "p95_ms": pct(0.95),
        "max_ms": round(d[-1], 1),
    }

@router.get("/perf")
def perf(minutes: int = Query(60, ge=1, le=1440)):
    rows = _read_rows(minutes)
    http_durs = [r.get("dur_ms") for r in rows if r.get("kind") == "http" and isinstance(r.get("dur_ms"), (int, float))]
    sel_durs  = [r.get("dur_ms") for r in rows if r.get("kind") == "fuseki" and r.get("op") == "select" and isinstance(r.get("dur_ms"), (int, float))]
    upd_durs  = [r.get("dur_ms") for r in rows if r.get("kind") == "fuseki" and r.get("op") == "update" and isinstance(r.get("dur_ms"), (int, float))]

    paths = Counter([r.get("path") for r in rows if r.get("kind") == "http" and r.get("path")])
    top_http_paths = [{"path": p, "count": c} for p, c in paths.most_common(10)]

    return {
        "window_minutes": minutes,
        "http": _stats(http_durs),
        "fuseki": {
            "select": _stats(sel_durs),
            "update": _stats(upd_durs),
        },
        "top_http_paths": top_http_paths,
    }


@router.get("/prometheus", include_in_schema=False)
def prometheus_metrics() -> Response:
    return Response(prometheus_latest(), media_type=CONTENT_TYPE_LATEST)
