import re

# <S> <P> O .  (Prädikat als IRI)
_PRED_RE_IRI   = re.compile(r'<[^>]+>\s+<([^>]+)>\s+', re.MULTILINE)
# <S> prefix:Local O .  (Prädikat als CURIE)
_PRED_RE_CURIE = re.compile(r'(?:<[^>]+>|[^\s;]+)\s+([A-Za-z][\w\-]*:[A-Za-z0-9_\-]+)\s+', re.MULTILINE)
# Prefix-Map aus der Query
_RE_PREFIX     = re.compile(r'^\s*PREFIX\s+([A-Za-z][\w\-]*):\s*<([^>]+)>\s*$', re.IGNORECASE | re.MULTILINE)
_PRED_RE_IRI_SEMI   = re.compile(r';\s*<([^>]+)>\s+', re.MULTILINE)
_PRED_RE_CURIE_SEMI = re.compile(r';\s*([A-Za-z][\w\-]*:[A-Za-z0-9_\-]+)\s+', re.MULTILINE)

def _prefix_map(q: str) -> dict[str, str]:
    return {m.group(1): m.group(2) for m in _RE_PREFIX.finditer(q or "")}

def _expand_curie(curie: str, pmap: dict[str, str]) -> str | None:
    if ":" not in curie:
        return None
    pfx, local = curie.split(":", 1)
    base = pmap.get(pfx)
    return base + local if base else None

def explain_update(query: str) -> dict:
    q  = (query or "").strip()
    qU = q.upper().replace("\n", " ")

    # Art der Operation heuristisch erkennen
    kind = "UPDATE"
    if "INSERT DATA" in qU:
        kind = "INSERT DATA"
    elif "DELETE DATA" in qU:
        kind = "DELETE DATA"
    elif "DELETE" in qU and "INSERT" in qU and "WHERE" in qU:
        kind = "DELETE/INSERT/WHERE"
    elif "DELETE" in qU and "WHERE" in qU:
        kind = "DELETE WHERE"
    elif "INSERT" in qU and "WHERE" in qU:
        kind = "INSERT WHERE"

    # Kurzbeschreibung
    if kind == "INSERT DATA":
        summary = "Fügt die angegebenen Tripel unverzüglich in den Datensatz ein."
    elif kind == "DELETE DATA":
        summary = "Löscht die angegebenen Tripel unverzüglich aus dem Datensatz."
    elif kind == "DELETE/INSERT/WHERE":
        summary = "Ersetzt Werte: Tripel aus DELETE werden für die WHERE-Matches entfernt und Tripel aus INSERT eingefügt."
    elif kind == "DELETE WHERE":
        summary = "Löscht alle Tripel, die im WHERE-Muster gefunden werden."
    elif kind == "INSERT WHERE":
        summary = "Fügt Tripel für alle Ressourcen ein, die im WHERE-Muster gefunden werden."
    else:
        summary = "SPARQL-Update erkannt; genaue Wirkung siehe Query."

    # Prädikate (als vollqualifizierte IRIs) sammeln
    pmap  = _prefix_map(q)
    preds = set(_PRED_RE_IRI.findall(q))
    for c in _PRED_RE_CURIE.findall(q):
        iri = _expand_curie(c, pmap)
        if iri:
            preds.add(iri)
    preds.update(_PRED_RE_IRI_SEMI.findall(q))
    for c in _PRED_RE_CURIE_SEMI.findall(q):
        iri = _expand_curie(c, pmap)
        if iri:
            preds.add(iri)

    return {
        "kind": kind,
        "summary": summary,
        "predicates": sorted(preds)[:20],
        "lines": len(q.splitlines()),
    }
