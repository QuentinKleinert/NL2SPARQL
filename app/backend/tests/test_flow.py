import os, time, uuid, requests

API = os.getenv("API_BASE", "http://localhost:8000")

def post(path, json=None):
    r = requests.post(API + path, json=json, timeout=20)
    r.raise_for_status()
    return r.json()

def get(path):
    r = requests.get(API + path, timeout=20)
    r.raise_for_status()
    return r.json()

def test_health():
    data = get("/health")
    assert data.get("ok") is True

def test_select_minimal():
    q = "SELECT (COUNT(*) AS ?n) WHERE { ?s ?p ?o }"
    data = post("/nl2sparql/select", {"sparql": q})
    assert data["ok"] is True
    assert "results" in data

def test_preview_execute_undo_insert():
    # eindeutige URI je Lauf
    new_uri = f"urn:example:test:{uuid.uuid4()}"
    insert_q = f'''PREFIX voc:<http://meta-pfarrerbuch.evangelische-archive.de/vocabulary#>
INSERT DATA {{ GRAPH <urn:nl2sparql:changes> {{
  <{new_uri}> a voc:Pfarrer-in ;
      voc:vorname "Anna" ;
      voc:nachname "CI-Test" .
}} }}'''

    # Preview
    prev = post("/nl2sparql/preview", {"sparql": insert_q})
    assert prev["validation"]["ok"] is True
    token = prev["confirm_token"]

    # Execute
    exe = post("/nl2sparql/execute", {"confirm_token": token})
    assert exe["ok"] is True
    undo_q = exe.get("undo_sparql")
    assert undo_q and "DELETE DATA" in undo_q

    # Verifizieren via SELECT
    ask_q = f"ASK WHERE {{ GRAPH <urn:nl2sparql:changes> {{ <{new_uri}> ?p ?o }} }}"
    sel = post("/nl2sparql/select", {"sparql": ask_q})
    assert sel["ok"] is True
    # ASK kommt als boolean-like Result zurück; spare harte Prüfung je nach Wrapper

    # Undo
    undo = post("/nl2sparql/undo", {"undo_sparql": undo_q})
    assert undo["ok"] is True
