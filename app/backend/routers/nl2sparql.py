from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import re
from uuid import uuid4
from time import time
from typing import Optional

from app.backend.services import sparql
from app.backend.services.validator import validate as validate_sparql
from app.backend.services.explain import explain_update

from app.backend.services.llm import generate_sparql_with_guardrails
from app.backend.config import get_settings

from app.backend.services.pseudonymizer import (
    mask_sparql_for_log,
    mask_log_record,
    enabled as pseudo_enabled,
)


router = APIRouter(prefix="/nl2sparql", tags=["nl2sparql"])

VOC = "http://meta-pfarrerbuch.evangelische-archive.de/vocabulary#"
PREFIX = f"PREFIX voc:<{VOC}>\n"




class GenerateReq(BaseModel):
    text: str
    intent: Optional[str] = None
class SelectReq(BaseModel):
    sparql: str

# --- In-Memory Bestätigungs-Store (einfach, volatil) ---
_PENDING: dict[str, dict] = {}
_TOKEN_TTL = 600  # Sekunden

_RE_PH_LITERAL = re.compile(r'"(PH\d+)"')

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

def _rehydrate_placeholders(q: str, ph: dict) -> str:
    # "PH1" -> '"Anna"' (mit Anführungszeichen), wie im anonymize_text gespeichert
    return _RE_PH_LITERAL.sub(lambda m: ph.get(m.group(1), m.group(0)), q)

def _is_update_query(q: str) -> bool:
    U = (q or "").upper()
    return any(k in U for k in ("INSERT", "DELETE", "UPDATE"))

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

def _ensure_changes_graph(update_q: str) -> str:
    g = get_settings().changes_graph

    # INSERT DATA { ... } -> INSERT DATA { GRAPH <g> { ... } }
    m = re.search(r'INSERT\s+DATA\s*{(.*)}\s*$', update_q, flags=re.IGNORECASE | re.DOTALL)
    if m and "GRAPH" not in m.group(1).upper():
        body = m.group(1).strip()
        return re.sub(
            r'INSERT\s+DATA\s*{.*}\s*$',
            f'INSERT DATA {{ GRAPH <{g}> {{\n{body}\n}} }}',
            update_q,
            flags=re.IGNORECASE | re.DOTALL
        )

    # DELETE DATA { ... } -> DELETE DATA { GRAPH <g> { ... } }
    m = re.search(r'DELETE\s+DATA\s*{(.*)}\s*$', update_q, flags=re.IGNORECASE | re.DOTALL)
    if m and "GRAPH" not in m.group(1).upper():
        body = m.group(1).strip()
        return re.sub(
            r'DELETE\s+DATA\s*{.*}\s*$',
            f'DELETE DATA {{ GRAPH <{g}> {{\n{body}\n}} }}',
            update_q,
            flags=re.IGNORECASE | re.DOTALL
        )

    # DELETE/INSERT/WHERE -> WITH <g> prefixen (falls nicht vorhanden)
    if re.search(r'\b(DELETE|INSERT)\b.*\bWHERE\b', update_q, flags=re.IGNORECASE) and "WITH " not in update_q.upper():
        return f'WITH <{g}>\n{update_q}'

    return update_q

@router.post("/preview")
def preview(req: PreviewReq):
    q = req.sparql
    if _is_update_query(q):
        q = _ensure_changes_graph(q)   # <--- hinzu
    v = validate_sparql(q)
    e = explain_update(q)
    token = _new_token({"sparql": q, "validation": v, "explain": e})
    return {"validation": v, "explain": e, "confirm_token": token, "ttl_seconds": _TOKEN_TTL}

# ----------------- Execute (mit Token) -----------------
class ExecuteReq(BaseModel):
    confirm_token: str

@router.post("/execute")
def execute(req: ExecuteReq):
    payload = _consume_token(req.confirm_token)
    if not payload:
        raise HTTPException(status_code=400, detail="Ungültiger oder abgelaufener Bestätigungs-Token.")

    sparql_text = payload["sparql"]                    # anonymisierte Fassung (kann PHx enthalten)
    placeholders = payload.get("placeholders", {})     # aus /generate o. /preview
    sparql_text_exec = _rehydrate_placeholders(sparql_text, placeholders) if placeholders else sparql_text

    # Nur Updates erlauben
    if not _is_update_query(sparql_text_exec):
        raise HTTPException(
            status_code=400,
            detail="Dies ist keine Update-Query (INSERT/DELETE/UPDATE). Bitte über /nl2sparql/select ausführen."
        )

    v = payload["validation"]
    e = payload["explain"]

    # Undo vorbereiten (zur tatsächlich ausgeführten Query passend)
    undo = _make_undo(sparql_text_exec)

    # Ausführen + Logging
    try:
        sparql.query_update(sparql_text_exec)
        log_sparql = mask_sparql_for_log(sparql_text) if pseudo_enabled() else sparql_text
        log_undo   = mask_sparql_for_log(undo) if (pseudo_enabled() and undo) else undo
      
        
        _log_change(
            status="applied",
            sparql_text=log_sparql,      
            validation=v,
            explain=e,
            undo_sparql=log_undo,
        )
        return {"ok": True, "message": "Änderung ausgeführt.", "undo_sparql": undo}
    except Exception as ex:
        log_sparql = mask_sparql_for_log(sparql_text) if pseudo_enabled() else sparql_text
        log_undo   = mask_sparql_for_log(undo) if (pseudo_enabled() and undo) else undo
        _log_change(
            status="failed",
            sparql_text=log_sparql,
            validation=v,
            explain=e,
            undo_sparql=log_undo,
            error=str(ex)
        )
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
        "error": error,
    }
    rec = mask_log_record(rec)  # <--- NEU: sicherheitshalber nochmals maskieren
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

        log_q = mask_sparql_for_log(undo_q) if pseudo_enabled() else undo_q

        _log_change(
            status="undo_applied",
            sparql_text=log_q,
            validation={"ok": True, "errors": [], "warnings": [], "used_uris": {}},
            explain={"kind": "UNDO", "summary": "Rückgängig machen einer früheren Änderung.", "predicates": [], "lines": len(undo_q.splitlines())},
            undo_sparql=None,
        )
        return {"ok": True, "message": "Undo ausgeführt."}
    except Exception as ex:
        log_q = mask_sparql_for_log(undo_q) if pseudo_enabled() else undo_q
        _log_change(
            status="undo_failed",
            sparql_text=log_q,
            validation={"ok": True, "errors": [], "warnings": [], "used_uris": {}},
            explain={"kind": "UNDO", "summary": "Rückgängig machen einer früheren Änderung.", "predicates": [], "lines": len(undo_q.splitlines())},
            undo_sparql=None,
            error=str(ex),
        )
        raise HTTPException(status_code=400, detail=f"Undo fehlgeschlagen: {ex}")
      
@router.post("/generate")
def generate(req: GenerateReq):
    out = generate_sparql_with_guardrails(req.text, intent_hint=req.intent)
    if not out.get("ok"):
        return {"ok": False, "reason": out.get("reason"), "sparql": out.get("sparql"), "validation": out.get("validation")}
    sparql_text = out["sparql"]
    if _is_update_query(sparql_text):
        sparql_text = _ensure_changes_graph(sparql_text)  # <--- hinzu
    validation = validate_sparql(sparql_text)
    e = explain_update(sparql_text)
    token = _new_token({
        "sparql": sparql_text,
        "validation": validation,
        "explain": e,
        "placeholders": out.get("placeholders", {})
    })
    return {
        "ok": True,
        "model": get_settings().llm_model,
        "sparql": sparql_text,
        "validation": validation,
        "explain": e,
        "confirm_token": token,
        "ttl_seconds": _TOKEN_TTL,
        "attempts": out.get("attempts", 1),
    }

    

@router.post("/select")
def run_select(req: SelectReq):
    try:
        data = sparql.query_select(req.sparql)
        return {"ok": True, "results": data}
    except Exception as ex:
        raise HTTPException(status_code=400, detail=f"SELECT fehlgeschlagen: {ex}")
