import httpx
from app.backend.config import get_settings

_client = httpx.Client(timeout=60.0)

def _ds() -> str:
    s = get_settings()
    return f"{s.fuseki_base_url}/{s.fuseki_dataset}"

def query_select(query: str) -> dict:
    s = get_settings()
    url = f"{_ds()}/sparql"
    r = _client.post(url, data={"query": query},
                     headers={"Accept": "application/sparql-results+json"})
    if r.status_code in (401, 403):
        r = _client.post(url, data={"query": query},
                         headers={"Accept": "application/sparql-results+json"},
                         auth=(s.fuseki_user, s.fuseki_password))
    r.raise_for_status()
    return r.json()

def query_update(update: str) -> None:
    s = get_settings()
    url = f"{_ds()}/update"
    r = _client.post(url, data={"update": update},
                     auth=(s.fuseki_user, s.fuseki_password))
    r.raise_for_status()
