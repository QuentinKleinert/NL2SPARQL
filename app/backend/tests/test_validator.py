import pytest

from app.backend.services import validator


def test_validator_warns_on_unknown_property(monkeypatch):
    def fake_select(query: str):
        if "?x" in query:
            return {"results": {"bindings": [{"x": {"value": "http://example.org/Class"}}]}}
        return {"results": {"bindings": [{"p": {"value": "http://example.org/prop"}}]}}

    monkeypatch.setattr(validator.sparql, "query_select", fake_select)
    validator._allowed_sets.cache_clear()

    res = validator.validate(
        "PREFIX ex:<http://example.org/>\nSELECT * WHERE { ?s ex:unknown ?o . }"
    )
    assert res["ok"] is True
    assert any("Unbekanntes Property" in w for w in res["warnings"])


def test_validator_recognises_known_terms(monkeypatch):
    def fake_select(query: str):
        if "?x" in query:
            return {"results": {"bindings": [{"x": {"value": "http://example.org/Class"}}]}}
        return {"results": {"bindings": [{"p": {"value": "http://example.org/prop"}}]}}

    monkeypatch.setattr(validator.sparql, "query_select", fake_select)
    validator._allowed_sets.cache_clear()

    res = validator.validate(
        "PREFIX ex:<http://example.org/>\nSELECT * WHERE { ?s ex:prop ?o ; a <http://example.org/Class> . }"
    )
    assert res["warnings"] == []
