from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from uuid import uuid4
from time import time
from typing import Optional

from app.backend.services import sparql
from app.backend.services.validator import validate as validate_sparql
from app.backend.services.explain import explain_update

router = APIRouter(prefix="/nl2sparql", tags=["nl2sparql"])

VOC = "http://meta-pfarrerbuch.evangelische-archive.de/vocabulary#"
PREFIX = f"PREFIX voc:<{VOC}>\n"

# --- In-Memory Bestätigungs-Store (einfach, volatil) ---
_PENDING: dict[str, dict] = {}
_TOKEN_TTL = 600  # Sekunden

def _new_token(payload: dict) -> str:
    tok = str(uuid4())
    _PENDING[tok] = {"created": time(), **payload}
    return tok

def _consume_token(tok: str) -> dict | None:
    item = _PENDING.pop(tok, None)
    if not item:
        return None
    if time() - item["created"] > _TOKEN_TTL:
        return None
    return item

# ----------------- Draft (bereits vorhanden) -----------------
class DraftReq(BaseModel):
    text: str
    intent: str | None = None

@router.post("/draft")
def draft(req: DraftReq):
    t = (req.text or "").lower()
    intent = req.intent
    if not intent:
        if any(k in t for k in ["füge", "hinzufügen", "insert", "neu"]):
            intent = "insert"
        elif any(k in t for k in ["ändere", "update", "ersetze", "korrigiere"]):
            intent = "update"
        elif any(k in t for k in ["lösche", "delete", "entferne"]):
            intent = "delete"
        else:
            intent = "select"

    if intent == "insert":
        sparql_text = PREFIX + """
INSERT DATA {
  <urn:example:person:1> a voc:Pfarrer-in ;
      voc:vorname "Max" ;
      voc:nachname "Mustermann" .
}
"""
        explanation = "Fügt eine(n) Pfarrer-in mit Vor- und Nachnamen ein (Beispielwerte)."
    elif intent == "update":
        sparql_text = PREFIX + """
# Beispiel: ändere den Nachnamen einer bekannten Person-URI
DELETE { <urn:example:person:1> voc:nachname ?old . }
INSERT { <urn:example:person:1> voc:nachname "Beispiel" . }
WHERE  { <urn:example:person:1> voc:nachname ?old . }
"""
        explanation = "Ersetzt den Nachnamen für eine spezifische Ressource."
    elif intent == "delete":
        sparql_text = PREFIX + """
# Beispiel: lösche die Pfarrstellen-Zuordnung
DELETE WHERE { <urn:example:person:1> voc:hatStelle ?stelle . }
"""
        explanation = "Löscht die Eigenschaft 'hatStelle' der Beispiel-Ressource."
    else:
        sparql_text = PREFIX + """
SELECT ?person ?vor ?nach WHERE {
  ?person a voc:Pfarrer-in ;
          voc:vorname ?vor ;
          voc:nachname ?nach .
} LIMIT 10
"""
        explanation = "Listet einige Pfarrer:innen mit Vor- und Nachnamen."

    return {
        "operation": intent.upper(),
        "sparql": sparql_text.strip(),
        "explanation": explanation
    }

# ----------------- Validate -----------------
class ValidateReq(BaseModel):
    sparql: str

@router.post("/validate")
def validate(req: ValidateReq):
    return validate_sparql(req.sparql)

# ----------------- Explain -----------------
class ExplainReq(BaseModel):
    sparql: str

@router.post("/explain")
def explain(req: ExplainReq):
    return explain_update(req.sparql)

# ----------------- Preview (Validate + Explain + Confirm-Token) -----------------
class PreviewReq(BaseModel):
    sparql: str

@router.post("/preview")
def preview(req: PreviewReq):
    v = validate_sparql(req.sparql)
    e = explain_update(req.sparql)
    token = _new_token({"sparql": req.sparql, "validation": v, "explain": e})
    return {"validation": v, "explain": e, "confirm_token": token, "ttl_seconds": _TOKEN_TTL}

# ----------------- Execute (mit Token) -----------------
class ExecuteReq(BaseModel):
    confirm_token: str

@router.post("/execute")
def execute(req: ExecuteReq):
    payload = _consume_token(req.confirm_token)
    if not payload:
        raise HTTPException(status_code=400, detail="Ungültiger oder abgelaufener Bestätigungs-Token.")
    sparql_text = payload["sparql"]
    v = payload["validation"]
    e = payload["explain"]

    # Undo-Heuristik für einfache Fälle
    undo = _make_undo(sparql_text)

    # Ausführen
    try:
        sparql.query_update(sparql_text)
        _log_change(status="applied", sparql_text=sparql_text, validation=v, explain=e, undo_sparql=undo)
        return {"ok": True, "message": "Änderung ausgeführt.", "undo_sparql": undo}
    except Exception as ex:
        _log_change(status="failed", sparql_text=sparql_text, validation=v, explain=e, undo_sparql=undo, error=str(ex))
        raise HTTPException(status_code=400, detail=f"Ausführung fehlgeschlagen: {ex}")

# ----------------- Undo Helper & Logging -----------------
import os, json, datetime, re

LOG_DIR = "app/backend/logs"
LOG_FILE = os.path.join(LOG_DIR, "changes.jsonl")
os.makedirs(LOG_DIR, exist_ok=True)

def _make_undo(q: str) -> str | None:
    # PREFIX-Zeilen einsammeln
    prefixes = []
    for line in (q or "").splitlines():
        if line.strip().upper().startswith("PREFIX "):
            prefixes.append(line)
    prefix_block = ("\n".join(prefixes) + "\n") if prefixes else ""

    # INSERT DATA -> DELETE DATA
    m_ins = re.search(r'INSERT\s+DATA\s*{(.*)}', q, flags=re.DOTALL | re.IGNORECASE)
    if m_ins:
        body = m_ins.group(1).strip()
        return f"{prefix_block}DELETE DATA {{\n{body}\n}}"

    # DELETE DATA -> INSERT DATA
    m_del = re.search(r'DELETE\s+DATA\s*{(.*)}', q, flags=re.DOTALL | re.IGNORECASE)
    if m_del:
        body = m_del.group(1).strip()
        return f"{prefix_block}INSERT DATA {{\n{body}\n}}"

    # komplexe Updates -> kein automatisches Undo
    return None

def _log_change(status: str, sparql_text: str, validation: dict, explain: dict, undo_sparql: str | None, error: str | None = None):
    rec = {
        "ts": datetime.datetime.utcnow().isoformat() + "Z",
        "status": status,
        "sparql": sparql_text,
        "validation": validation,
        "explain": explain,
        "undo_sparql": undo_sparql,
        "error": error
    }
    with open(LOG_FILE, "a", encoding="utf-8") as f:
        f.write(json.dumps(rec, ensure_ascii=False) + "\n")

class UndoReq(BaseModel):
    undo_sparql: Optional[str] = None
    log_record: Optional[dict] = None

@router.post("/undo")
def undo(req: UndoReq):
    undo_q = req.undo_sparql or (req.log_record or {}).get("undo_sparql")
    if not undo_q:
        raise HTTPException(status_code=400, detail="Kein undo_sparql angegeben.")
    try:
        sparql.query_update(undo_q)
        _log_change(
            status="undo_applied",
            sparql_text=undo_q,
            validation={"ok": True, "errors": [], "warnings": [], "used_uris": {}},
            explain={"kind": "UNDO", "summary": "Rückgängig machen einer früheren Änderung.", "predicates": [], "lines": len(undo_q.splitlines())},
            undo_sparql=None
        )
        return {"ok": True, "message": "Undo ausgeführt."}
    except Exception as ex:
        _log_change(
            status="undo_failed",
            sparql_text=undo_q,
            validation={"ok": True, "errors": [], "warnings": [], "used_uris": {}},
            explain={"kind": "UNDO", "summary": "Rückgängig machen einer früheren Änderung.", "predicates": [], "lines": len(undo_q.splitlines())},
            undo_sparql=None,
            error=str(ex)
        )
        raise HTTPException(status_code=400, detail=f"Undo fehlgeschlagen: {ex}")