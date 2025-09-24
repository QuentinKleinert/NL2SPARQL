# NL2SPARQL - Bachelorarbeit (Quentin Kleinert)

Eine kleine End-to-End-Anwendung, die natürliche Sprache in SPARQL übersetzt, Updates absichert (Preview-Token, Changes-Graph, Undo) und SELECTs ausführt.

## Architektur

[UI (Vite + Nginx)] --/api--> [FastAPI Backend] --HTTP--> [Apache Jena Fuseki]
│
└── Logs + Changes-Graph (Undo)

### Services

- web: Nginx dient die gebaute UI aus und proxyt /api → Backend

- pi: FastAPI (SPARQL-Generate, Validate/Explain, Preview/Execute, Undo, SELECT)

- fuseki: Apache Jena Fuseki, Dataset combined (persistiert im Docker-Volume)

### Sicherheitsmaßnahmen

- Preview-Token (TTL ~10 min): Updates werden nur mit gültigem Token ausgeführt.

- Changes-Graph: Alle INSERT/DELETE landen zusätzlich im CHANGES_GRAPH (Undo-freundlich).

- Undo: Für INSERT DATA / DELETE DATA wird automatisch eine inverse Query erzeugt.

- Validate/Explain: Vor Ausführung prüfbar über /validate und /explain.

## Setup (Docker)

```
.env (Beispiel):
FUSEKI_BASE_URL=http://fuseki:3030
FUSEKI_DATASET=combined
FUSEKI_USER=admin
FUSEKI_PASSWORD=admin

OPENAI_API_KEY=dein_schluessel
LLM_MODEL=gpt-4.1-mini
LLM_TEMPERATURE=0.2
LLM_MAX_OUTPUT_TOKENS=1200

CHANGES_GRAPH=urn:nl2sparql:changes
```

### Build & Start

```
# aus Repo-Root
printf "VITE_BACKEND_BASE_URL=/api\n" > ui/.env.production
cd ui && npm ci && npm run build && cd ..
docker compose up -d --build

```

UI: http://localhost:8080
Fuseki UI: http://localhost:3030
Beim Neustart des Rechners reicht: docker compose up -d
Daten bleiben im Volume fuseki-data erhalten.

## Datenimport (lokal)

Voraussetzung Fuseki läuft (siehe oben)

```
# große N-Quads laden (nicht im Repo enthalten)
gunzip -c vendor/pfarrerdaten/meta-combined.nq.gz \
| curl -u admin:${FUSEKI_PASSWORD:-admin} \
  -X POST -H "Content-Type: application/n-quads" \
  --data-binary @- \
  "http://localhost:3030/combined/data"

# Vokabular als Default-Graph
gunzip -c vendor/pfarrerdaten/vocabulary.nt.gz \
| curl -u admin:${FUSEKI_PASSWORD:-admin} \
  -X POST -H "Content-Type: application/n-triples" \
  --data-binary @- \
  "http://localhost:3030/combined/data?default"

```

Hinweis: Die Originaldaten des Betreuers sind aus rechtlichen Gründen nicht im Repository und liegen unter vendor/ (ignored).

## API (Auszug)

- POST /nl2sparql/generate → { text } ⇒ SPARQL + confirm_token (+ Validate/Explain)

- POST /nl2sparql/preview → { sparql } ⇒ Validate/Explain + confirm_token

- POST /nl2sparql/execute → { confirm_token } ⇒ führt Update aus

- POST /nl2sparql/select → { sparql } ⇒ SELECT/ASK (JSON)

- POST /nl2sparql/undo → { log_record } ⇒ inverse Änderung anwenden

- GET /ontology/terms → Klassen/Properties (Auszug)

- GET /logs/recent?limit=10 → letzte Änderungen inkl. Undo-SPARQL

## Entwicklung

```
# UI (Dev)
cd ui && npm run dev          # Backend in der UI umstellbar (Input "Backend")

# API (Dev)
uvicorn app.backend.main:app --reload

```

## Tests

Integrationstests (Beispiel): tests/test_flow.py – Preview → Execute → Undo, plus ein SELECT-Test.
Test-Requirements (tests/requirements.txt):

```
pytest==8.3.3
requests==2.32.3

```

Ausführen:

```
python -m venv .venv && source .venv/bin/activate
pip install -r tests/requirements.txt
pytest -q
```

## CI (optional)

Wenn .github/workflows/ci.yml vorhanden ist, prüft GitHub Actions Build/Tests bei jedem Push/PR.
Nicht zwingend für die Arbeit, aber professionell.

## Troubleshooting

- 405 / Method Not Allowed: falsches Fuseki-Endpoint (nutze /combined/data für Upload, /combined/sparql für Queries).

- API kann Fuseki nicht erreichen: Im Container ist die Base-URL http://fuseki:3030, nicht localhost.

- Token abgelaufen: In der UI erneut Preview oder Generate, dann Execute.

- Port belegt / Container-Konflikt: docker compose down && docker ps -a && docker rm -f <namen>.

## Daten

Die bereitgestellten Pfarrerdaten sind nicht Teil der Lizenz und werden nicht im Repo verteilt.

## Kurzer Testplan

1. Ping ok, Terms laden.

2. NL → Generate (Token sichtbar).

3. Preview → Validate/Explain ok, Token erneuert.

4. Execute → Log „APPLIED“.

5. Undo in „Recent Logs“ → Log „REVERTED“.

6. Ein einfacher SELECT → Tabelle erscheint.

## Benchmark

python tools/perf_report.py
