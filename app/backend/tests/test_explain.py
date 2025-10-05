from app.backend.services.explain import explain_update


def test_explain_insert_data():
    query = "INSERT DATA { <urn:test> <urn:p> \"x\" . }"
    res = explain_update(query)
    assert res["kind"] == "INSERT DATA"
    assert "fügt".lower() in res["summary"].lower()


def test_explain_collects_predicates():
    query = "PREFIX voc:<http://example.org/> INSERT DATA { <urn:test> voc:name \"Max\" ; voc:city \"Berlin\" . }"
    res = explain_update(query)
    assert "http://example.org/name" in res["predicates"] or len(res["predicates"]) >= 1
