from fastapi import APIRouter, Depends
from app.backend.services import sparql
from app.backend.services.security import rate_limit_dependency

router = APIRouter(
    prefix="/ontology",
    tags=["ontology"],
    dependencies=[Depends(rate_limit_dependency)],
)

_QUERY_CLASSES = """
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX owl:  <http://www.w3.org/2002/07/owl#>
SELECT DISTINCT ?c ?label WHERE {
  { ?c a rdfs:Class } UNION { ?c a owl:Class }
  OPTIONAL { ?c rdfs:label ?label }
} ORDER BY ?c
"""

_QUERY_PROPERTIES = """
PREFIX rdf:  <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX owl:  <http://www.w3.org/2002/07/owl#>
SELECT DISTINCT ?p ?label WHERE {
  { ?p a rdf:Property } UNION { ?p a owl:ObjectProperty } UNION { ?p a owl:DatatypeProperty }
  OPTIONAL { ?p rdfs:label ?label }
} ORDER BY ?p
"""

@router.get("/terms")
def get_terms():
    classes = sparql.query_select(_QUERY_CLASSES)
    props   = sparql.query_select(_QUERY_PROPERTIES)

    def rows(res, u, l):
        for b in res["results"]["bindings"]:
            uri = b[u]["value"]
            lbl = b.get(l, {}).get("value")
            yield {"uri": uri, "label": lbl}

    return {"classes": list(rows(classes, "c", "label")),
            "properties": list(rows(props, "p", "label"))}
