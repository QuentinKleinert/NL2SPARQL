from fastapi import APIRouter

from app.backend.services import sparql

router = APIRouter(prefix="/kps", tags=["kps"])

KPS_GRAPH = "http://meta-pfarrerbuch.evangelische-archive.de/data/kps/"


@router.get("/sample")
def sample_select():
    query = f"""
    PREFIX voc:<http://meta-pfarrerbuch.evangelische-archive.de/vocabulary#>
    PREFIX rdfs:<http://www.w3.org/2000/01/rdf-schema#>

    SELECT ?person ?label
    WHERE {{
      GRAPH <{KPS_GRAPH}> {{
        ?person a voc:Pfarrer-in ;
                rdfs:label ?label .
      }}
    }}
    LIMIT 10
    """
    return sparql.query_select(query)
