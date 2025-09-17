from fastapi import APIRouter, Query
import json, os

router = APIRouter(prefix="/logs", tags=["logs"])

LOG_PATH = "app/backend/logs/changes.jsonl"

@router.get("/recent")
def recent_logs(limit: int = Query(50, ge=1, le=500)):
    if not os.path.exists(LOG_PATH):
        return {"items": []}
    items = []
    # effizient: von hinten lesen ist aufwendiger; hier simple Variante
    with open(LOG_PATH, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                items.append(json.loads(line))
            except Exception:
                continue
    return {"items": items[-limit:]}
