from __future__ import annotations
import os, re, hmac, hashlib, base64
from typing import Iterable

# ENV-Konfiguration (mit Defaults)
_PSEUDO_ON = os.getenv("PSEUDONYMIZE_LOGS", "1").strip() not in ("0", "false", "False", "")
_SALT = os.getenv("LOG_PSEUDO_SALT", "change-me-in-prod")
_FIELDS = [f.strip() for f in os.getenv("LOG_PSEUDO_FIELDS", "voc:vorname,voc:nachname").split(",") if f.strip()]

def enabled() -> bool:
    return _PSEUDO_ON

def pseudonym(value: str) -> str:
    """Stabiles, kurzes Pseudonym aus dem Klartext erzeugen (HMAC-SHA256)."""
    if not value:
        return value
    digest = hmac.new(_SALT.encode("utf-8"), value.encode("utf-8"), hashlib.sha256).digest()
    token = base64.b32encode(digest)[:8].decode("ascii").rstrip("=")  # 8 Base32-Zeichen
    return f"px-{token.lower()}"

def mask_sparql_for_log(sparql_text: str, fields: Iterable[str] | None = None) -> str:
    """
    Ersetzt Literalwerte hinter bestimmten Properties (z.B. voc:vorname "Max") durch Pseudonyme.
    Funktioniert für INSERT/DELETE DATA und einfache UPDATE-Statements.
    """
    if not enabled():
        return sparql_text
    fields = list(fields or _FIELDS)
    out = sparql_text

    # Beispiel-Pattern:  voc:vorname   "Max"
    # Greift NICHT auf URIs oder BlankNodes, nur Literale in "..."
    for prop in fields:
        # \bprop\s*"VALUE"
        pat = re.compile(rf'(\b{re.escape(prop)}\s*["\'])([^"\']+)(["\'])')
        out = pat.sub(lambda m: m.group(1) + pseudonym(m.group(2)) + m.group(3), out)
    return out

def mask_log_record(rec: dict) -> dict:
    """
    Optional: ganze Log-Records maskieren (falls z.B. zusätzlich Felder wie "values": {...} existieren).
    Aktuell maskieren wir nur die SPARQL-Felder.
    """
    if not enabled():
        return rec
    r = dict(rec)
    if "sparql" in r and isinstance(r["sparql"], str):
        r["sparql"] = mask_sparql_for_log(r["sparql"])
    if "undo_sparql" in r and isinstance(r["undo_sparql"], str):
        r["undo_sparql"] = mask_sparql_for_log(r["undo_sparql"])
    return r
