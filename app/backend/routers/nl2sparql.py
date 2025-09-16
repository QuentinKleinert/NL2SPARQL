from fastapi import APIRouter
from pydantic import BaseModel
from app.backend.services import sparql

router = APIRouter(prefix="/nl2sparql", tags=["nl2sparql"])

VOC = "http://meta-pfarrerbuch.evangelische-archive.de/vocabulary#"
PREFIX = f"PREFIX voc:<{VOC}>\n"

class DraftReq(BaseModel):
    text: str
    intent: str | None = None  # "insert"|"update"|"delete" optional

@router.post("/draft")
def draft(req: DraftReq):
    t = (req.text or "").lower()
    intent = req.intent
    if not intent:
        if any(k in t for k in ["füge", "hinzufügen", "insert", "neu"]):
            intent = "insert"
        elif any(k in t for k in ["ändere", "update", "ersetze", "korrigiere"]):
            intent = "update"
        elif any(k in t for k in ["lösche", "delete", "entferne"]):
            intent = "delete"
        else:
            intent = "select"

    if intent == "insert":
        # Platzhalter-IRI – in echt generieren wir UUIDs/URIs
        sparql_text = PREFIX + """
INSERT DATA {
  <urn:example:person:1> a voc:Pfarrer-in ;
      voc:vorname "Max" ;
      voc:nachname "Mustermann" .
}
"""
        explanation = "Fügt eine(n) Pfarrer-in mit Vor- und Nachnamen ein (Beispielwerte)."
    elif intent == "update":
        sparql_text = PREFIX + """
# Beispiel: ändere den Nachnamen einer bekannten Person-URI
DELETE { <urn:example:person:1> voc:nachname ?old . }
INSERT { <urn:example:person:1> voc:nachname "Beispiel" . }
WHERE  { <urn:example:person:1> voc:nachname ?old . }
"""
        explanation = "Ersetzt den Nachnamen für eine spezifische Ressource."
    elif intent == "delete":
        sparql_text = PREFIX + """
# Beispiel: lösche die Pfarrstellen-Zuordnung
DELETE WHERE { <urn:example:person:1> voc:hatStelle ?stelle . }
"""
        explanation = "Löscht die Eigenschaft 'hatStelle' der Beispiel-Ressource."
    else:
        sparql_text = PREFIX + """
SELECT ?person ?vor ?nach WHERE {
  ?person a voc:Pfarrer-in ;
          voc:vorname ?vor ;
          voc:nachname ?nach .
} LIMIT 10
"""
        explanation = "Listet einige Pfarrer:innen mit Vor- und Nachnamen."

    return {
        "operation": intent.upper(),
        "sparql": sparql_text.strip(),
        "explanation": explanation
    }
