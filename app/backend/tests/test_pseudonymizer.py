from app.backend.services import pseudonymizer as p


def test_pseudonymizer_masks_literals_and_uris():
    sample = (
        'INSERT DATA { GRAPH <urn:nl2sparql:changes> {\n'
        '  <urn:person:MaxMustermann> voc:vorname "Max" ;\n'
        '      voc:nachname "Mustermann" ;\n'
        '      voc:geburtsname Anna .\n'
        '} }'
    )
    masked = p.mask_sparql_for_log(sample)
    assert "Max" not in masked
    assert "Mustermann" not in masked
    assert "Anna" not in masked
    assert "urn:person" not in masked
    assert "px-" in masked


def test_mask_log_record_applies_to_fields():
    rec = {"sparql": 'voc:vorname "Lisa"', "undo_sparql": 'voc:nachname "Test"'}
    masked = p.mask_log_record(rec)
    assert masked != rec
    assert "Lisa" not in masked["sparql"]
    assert "Test" not in masked["undo_sparql"]
