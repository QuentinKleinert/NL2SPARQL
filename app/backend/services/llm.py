from __future__ import annotations
import os, re, textwrap
from typing import Tuple, Optional, List, Dict

from openai import OpenAI
from app.backend.config import get_settings
from app.backend.services import sparql
from app.backend.services.validator import validate as validate_sparql

# ---------- OpenAI Client ----------
def _client() -> OpenAI:
    s = get_settings()
    os.environ.setdefault("OPENAI_API_KEY", s.openai_api_key)
    return OpenAI()

# ---------- Ontologie-Kontext: nur Klassen/Properties (keine Instanzen) ----------
def _fetch_terms(limit_each: int = 150) -> Tuple[List[str], List[str]]:
    q_classes = """
    PREFIX rdfs:<http://www.w3.org/2000/01/rdf-schema#>
    PREFIX owl:<http://www.w3.org/2002/07/owl#>
    SELECT DISTINCT ?x WHERE { { ?x a rdfs:Class } UNION { ?x a owl:Class } } ORDER BY ?x
    """
    q_props = """
    PREFIX rdf:<http://www.w3.org/1999/02/22-rdf-syntax-ns#>
    PREFIX owl:<http://www.w3.org/2002/07/owl#>
    SELECT DISTINCT ?p WHERE {
      { ?p a rdf:Property } UNION { ?p a owl:ObjectProperty } UNION { ?p a owl:DatatypeProperty }
    } ORDER BY ?p
    """
    cls = [b["x"]["value"] for b in sparql.query_select(q_classes)["results"]["bindings"]][:limit_each]
    props = [b["p"]["value"] for b in sparql.query_select(q_props)["results"]["bindings"]][:limit_each]
    return cls, props

# ---------- Mini-Anonymisierung des Usertexts ----------
_ANON_NUMBER = re.compile(r'\b\d{1,4}([.-]\d{1,2}([.-]\d{1,2})?)?\b')
_KEYWORD_PHRASE = re.compile(
    r'(?i)\b(vorname|nachname|geburtsname|name|gemeinde|ort|kirche|pfarrer(?:in)?)\s*[:=]?\s*([A-ZÄÖÜ][A-Za-zÄÖÜäöüß\-]+(?:\s+[A-ZÄÖÜ][A-Za-zÄÖÜäöüß\-]+)?)'
)


def anonymize_text(user_text: str) -> Tuple[str, Dict[str, str]]:
    """
    Heuristik: Ersetzt Strings in Anführungszeichen, Schlüsselwort-Phrasen und Datum/Jahr durch Platzhalter.
    """
    placeholders: Dict[str, str] = {}
    t = user_text or ""

    def _reserve(val: str) -> str:
        key = f"PH{len(placeholders) + 1}"
        placeholders[key] = val
        return key

    def repl_quotes(m: re.Match[str]) -> str:
        return _reserve(m.group(0))

    t = re.sub(r'"[^"]+"', repl_quotes, t)
    t = re.sub(r"'[^']+'", repl_quotes, t)

    def repl_keyword(m: re.Match[str]) -> str:
        prefix = m.group(1)
        value = m.group(2)
        placeholder = _reserve(value)
        return f"{prefix} {placeholder}"

    t = _KEYWORD_PHRASE.sub(repl_keyword, t)

    t = _ANON_NUMBER.sub("PH_YEAR", t)
    return t, placeholders

# ---------- Prompt/Guardrails ----------
VOC = "http://meta-pfarrerbuch.evangelische-archive.de/vocabulary#"
PREFIX_BLOCK = textwrap.dedent(f"""
    PREFIX voc:<{VOC}>
    PREFIX rdf:<http://www.w3.org/1999/02/22-rdf-syntax-ns#>
    PREFIX rdfs:<http://www.w3.org/2000/01/rdf-schema#>
    PREFIX owl:<http://www.w3.org/2002/07/owl#>
""").strip()

DISALLOWED = ("DROP", "LOAD", "CREATE", "CLEAR", "MOVE", "COPY", "ADD", "SERVICE")

def _system_prompt(classes: List[str], props: List[str], graph: str) -> str:
    def short(u: str) -> str: return u.replace(VOC, "voc:#")
    classes_s = ", ".join(short(c) for c in classes[:120]) or "(keine)"
    props_s   = ", ".join(short(p) for p in props[:200]) or "(keine)"

    return textwrap.dedent(f"""
    Du bist ein strenger SPARQL-Generator (Apache Jena Fuseki).
    Regeln:
    - Gib NUR einen ```sparql ...``` Codeblock aus (kein Fließtext).
    - Nutze GENAU diese Prefixes (keine anderen):
      {PREFIX_BLOCK}
    - Nutze ausschließlich Klassen/Properties aus dem Vokabular (siehe unten).
    - Keine Graph-Management-Befehle ({", ".join(DISALLOWED)}).
    - **WICHTIG:** Schreibe ALLE Updates in den Named Graph <{graph}>
    Beispiele:
      INSERT DATA {{ GRAPH <{graph}> {{ ... }} }}
      DELETE DATA {{ GRAPH <{graph}> {{ ... }} }}
      WITH <{graph}>
      DELETE {{ ... }} INSERT {{ ... }} WHERE {{ ... }}
    - Wenn konkrete Personen/Orte/Zeitwerte vorkommen: nutze Platzhalter-URIs (<urn:example:...>) oder Variablen mit WHERE.
    - Für Updates:
        * INSERT DATA {{ ... }}      (einfaches Einfügen)
        * DELETE DATA {{ ... }}      (einfaches Löschen)
        * DELETE/INSERT/WHERE        (Ersetzen)
        * DELETE WHERE               (vorsichtig)
    - Wenn unklar, kommentiere TODOs im Code.

    Erlaubte Klassen (Auszug): {classes_s}
    Erlaubte Properties (Auszug): {props_s}

    Format:
    ```sparql
    {PREFIX_BLOCK}
    <DEIN SPARQL>
    ```
    """)

def _fewshots(graph: str) -> List[Tuple[str, str]]:
    return [
        (
            'Füge einen neuen Pfarrer mit Vorname "Max" und Nachname "Mustermann" hinzu.',
            f"""```sparql
{PREFIX_BLOCK}

INSERT DATA {{
  GRAPH <{graph}> {{
    <urn:example:person:NEW> a voc:Pfarrer-in ;
        voc:vorname "Max" ;
        voc:nachname "Mustermann" .
  }}
}}
```"""
        ),
        (
            'Ändere den Nachnamen auf "Schmidt" für diese Person-URI.',
            f"""```sparql
{PREFIX_BLOCK}

WITH <{graph}>
DELETE {{ <urn:example:person:TARGET> voc:nachname ?old . }}
INSERT {{ <urn:example:person:TARGET> voc:nachname "Schmidt" . }}
WHERE  {{ <urn:example:person:TARGET> voc:nachname ?old . }}
```"""
        ),
        (
            "Lösche die Pfarrstellen-Zuordnung einer Person.",
            f"""```sparql
{PREFIX_BLOCK}

DELETE DATA {{
  GRAPH <{graph}> {{
    <urn:example:person:TARGET> voc:hatStelle <urn:example:stelle:ID> .
  }}
}}
```"""
        ),
        (
            "Zeige alle Pfarrer mit Vor- und Nachnamen.",
            f"""```sparql
{PREFIX_BLOCK}

SELECT ?person ?vor ?nach WHERE {{
  ?person a voc:Pfarrer-in ;
          voc:vorname ?vor ;
          voc:nachname ?nach .
}} LIMIT 20
```"""
        ),
    ]


_CODEBLOCK_RE = re.compile(r"```sparql\s*(.*?)```", re.DOTALL | re.IGNORECASE)
def _extract_sparql_from_text(txt: str) -> Optional[str]:
    m = _CODEBLOCK_RE.search(txt or "")
    if m:
        return m.group(1).strip()
    body = (txt or "").strip()
    if any(k in body.upper() for k in ("INSERT", "DELETE", "SELECT", "UPDATE")):
        return body
    return None

def _contains_disallowed(q: str) -> Optional[str]:
    U = (q or "").upper()
    for bad in DISALLOWED:
        if bad in U:
            return bad
    return None

def _make_feedback(v: Dict) -> str:
    msgs = []
    for e in v.get("errors", []):
        msgs.append(f"Fehler: {e}")
    for w in v.get("warnings", []):
        msgs.append(f"Warnung: {w}")
    return "\n".join(msgs) if msgs else "Keine Fehler/Warnungen, nur Ontologie-konform bleiben."

def generate_sparql_with_guardrails(user_text: str, intent_hint: Optional[str]=None, retry_if_invalid: bool=True) -> Dict:
    s = get_settings()
    classes, props = _fetch_terms()
    graph = s.changes_graph

    anon_text, _ph = anonymize_text(user_text)
    sys_prompt = _system_prompt(classes, props, graph)

    messages = [{"role": "system", "content": sys_prompt}]
    for nl, sp in _fewshots(graph):
        messages.append({"role": "user", "content": nl})
        messages.append({"role": "assistant", "content": sp})

    user_msg = f"[Intent={intent_hint}] {anon_text}" if intent_hint else anon_text
    messages.append({"role": "user", "content": user_msg})

    client = _client()
    resp = client.responses.create(
        model=s.llm_model,
        temperature=s.llm_temperature,
        max_output_tokens=s.llm_max_output_tokens,
        input=messages,
    )
    draft = getattr(resp, "output_text", None) or \
        (resp.output[0].content[0].text if getattr(resp, "output", None) else "") or ""

    sparql_text = _extract_sparql_from_text(draft) or ""

    bad = _contains_disallowed(sparql_text)
    if bad:
        return {"ok": False, "reason": f"Disallowed keyword: {bad}", "sparql": sparql_text}

    v = validate_sparql(sparql_text)
    if (not v.get("ok")) or v.get("errors"):
        if retry_if_invalid:
            feedback = _make_feedback(v)
            messages.append({"role": "assistant", "content": f"Vorheriger Vorschlag:\n```sparql\n{sparql_text}\n```"})
            messages.append({"role": "user", "content": f"Korrigiere gemäß Feedback:\n{feedback}\nNur gültigen ```sparql``` Codeblock ausgeben."})
            resp2 = client.responses.create(
                model=s.llm_model,
                temperature=s.llm_temperature,
                max_output_tokens=s.llm_max_output_tokens,
                input=messages,
            )
            draft2 = resp2.output_text or ""
            sparql_text2 = _extract_sparql_from_text(draft2) or ""
            bad2 = _contains_disallowed(sparql_text2)
            if bad2:
                return {"ok": False, "reason": f"Disallowed keyword: {bad2}", "sparql": sparql_text2}
            v2 = validate_sparql(sparql_text2)
            return {"ok": v2.get("ok", False), "sparql": sparql_text2, "validation": v2, "attempts": 2, "placeholders": _ph}
        return {"ok": False, "sparql": sparql_text, "validation": v, "attempts": 1, "placeholders": _ph}

    return {"ok": True, "sparql": sparql_text, "validation": v, "attempts": 1, "placeholders": _ph}
