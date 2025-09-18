import re
from functools import lru_cache
from app.backend.services import sparql

# PREFIX-Zeilen erkennen
_RE_PREFIX = re.compile(r'^\s*PREFIX\s+([A-Za-z][\w\-]*):\s*<([^>]+)>\s*$', re.IGNORECASE | re.MULTILINE)

# Klassen via "a <IRI>" oder "rdf:type <IRI>" ODER "a prefix:Local"
_RE_CLASS_IRI  = re.compile(r'(?:\ba\s+|rdf:type\s+)<([^>]+)>', re.IGNORECASE)
_RE_CLASS_CURIE= re.compile(r'(?:\ba\s+|rdf:type\s+)([A-Za-z][\w\-]*:[A-Za-z0-9_\-]+)', re.IGNORECASE)

# Alle URIs zwischen <...>
_RE_ANY_IRI    = re.compile(r'<([^>]+)>')
# Alle CURIEs wie voc:vorname (grob)
_RE_ANY_CURIE  = re.compile(r'([A-Za-z][\w\-]*:[A-Za-z0-9_\-]+)')

@lru_cache(maxsize=1)
def _allowed_sets():
    q_classes = """
    PREFIX rdfs:<http://www.w3.org/2000/01/rdf-schema#>
    PREFIX owl:<http://www.w3.org/2002/07/owl#>
    SELECT DISTINCT ?x WHERE { { ?x a rdfs:Class } UNION { ?x a owl:Class } }
    """
    q_props = """
    PREFIX rdf:<http://www.w3.org/1999/02/22-rdf-syntax-ns#>
    PREFIX owl:<http://www.w3.org/2002/07/owl#>
    SELECT DISTINCT ?p WHERE {
      { ?p a rdf:Property } UNION { ?p a owl:ObjectProperty } UNION { ?p a owl:DatatypeProperty }
    }
    """
    cls = {b["x"]["value"] for b in sparql.query_select(q_classes)["results"]["bindings"]}
    props = {b["p"]["value"] for b in sparql.query_select(q_props)["results"]["bindings"]}
    return cls, props

def refresh_allowed_cache():
    _allowed_sets.cache_clear()
    _allowed_sets()

def _prefix_map(query: str) -> dict[str, str]:
    return {m.group(1): m.group(2) for m in _RE_PREFIX.finditer(query or "")}

def _expand_curie(curie: str, pmap: dict[str, str]) -> str | None:
    if ":" not in curie: return None
    pfx, local = curie.split(":", 1)
    base = pmap.get(pfx)
    if not base: return None
    return base + local

def _extract_used(query: str):
    pmap = _prefix_map(query)

    # Klassen
    used_cls = set(_RE_CLASS_IRI.findall(query or ""))
    for c in _RE_CLASS_CURIE.findall(query or ""):
        iri = _expand_curie(c, pmap)
        if iri: used_cls.add(iri)

    # Alle IRIs/CURIEs einsammeln …
    iris = set(_RE_ANY_IRI.findall(query or ""))
    for c in _RE_ANY_CURIE.findall(query or ""):
        iri = _expand_curie(c, pmap)
        if iri: iris.add(iri)

    # … aber URIs aus PREFIX-Zeilen ausdrücklich ausschließen
    iris -= set(pmap.values())

    used_props = iris - used_cls
    used_props = {u for u in used_props if u.startswith("http")}
    used_cls   = {u for u in used_cls   if u.startswith("http")}
    return used_cls, used_props

def validate(query: str) -> dict:
    allowed_classes, allowed_props = _allowed_sets()
    used_classes, used_props = _extract_used(query or "")

    warnings, errors = [], []
    for c in sorted(used_classes):
        if c not in allowed_classes:
            warnings.append(f"Unbekannte Klasse: <{c}>")
    for p in sorted(used_props):
        if p not in allowed_props:
            warnings.append(f"Unbekanntes Property: <{p}>")

    # sehr grober Syntaxhinweis
    U = (query or "").upper()
    if not any(k in U for k in ("INSERT", "DELETE", "WHERE", "UPDATE")):
        warnings.append("Query enthält keine offensichtlichen SPARQL-Update-Konstrukte.")

    return {
        "ok": len(errors) == 0,
        "errors": errors,
        "warnings": warnings,
        "used_uris": {
            "classes": sorted(used_classes),
            "properties": sorted(used_props),
        },
    }
