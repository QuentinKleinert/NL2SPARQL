from app.backend.services.llm import anonymize_text


def test_anonymize_text_handles_keywords_and_quotes():
    text = 'Ändere den Vorname Max und Nachname Mustermann, geboren am 1975-04-12.'
    anonymised, placeholders = anonymize_text(text)
    assert "Max" not in anonymised
    assert "Mustermann" not in anonymised
    assert "1975-04-12" not in anonymised
    assert len(placeholders) >= 2
