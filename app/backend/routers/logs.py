# app/backend/routers/logs.py
from fastapi import APIRouter, Query
import json, os
from app.backend.services.pseudonymizer import mask_log_record  

router = APIRouter(prefix="/logs", tags=["logs"])

LOG_PATH = "app/backend/logs/changes.jsonl"

@router.get("/recent")
def recent_logs(limit: int = Query(50, ge=1, le=500)):
    if not os.path.exists(LOG_PATH):
        return {"items": []}
    items = []
    with open(LOG_PATH, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                rec = json.loads(line)
                rec = mask_log_record(rec)         
                items.append(rec)
            except Exception:
                continue
    return {"items": items[-limit:][::-1]}

