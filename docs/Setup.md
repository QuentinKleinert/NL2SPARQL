# Setup

## Voraussetzungen

- Docker Desktop
- Python 3.11+ (venv)
- macOS (Apple Silicon) – Compose nutzt amd64 Image mit Emulation

## Projektstruktur

- infra/docker-compose.yml – startet Fuseki
- infra/config-runtime.ttl – unser Dataset "combined"
- infra/fuseki/ – persistente DB + `shiro.ini` (nicht commiten)
- vendor/pfarrerdaten/ – Prof-Daten (nicht commiten)
- app/backend – FastAPI

## Start

```bash
cd infra
docker compose up -d
# Daten importieren
gunzip -c ../vendor/pfarrerdaten/meta-combined.nq.gz | \
curl -u admin:admin -X POST -H "Content-Type: application/n-quads" --data-binary @- \
  "http://localhost:3030/combined/data"

gunzip -c ../vendor/pfarrerdaten/vocabulary.nt.gz | \
curl -u admin:admin -X POST -H "Content-Type: application/n-triples" --data-binary @- \
  "http://localhost:3030/combined/data?default"
```

## Backend

In .env im Projektroot:
FUSEKI_BASE_URL=http://localhost:3030
FUSEKI_DATASET=combined
FUSEKI_USER=admin
FUSEKI_PASSWORD=admin

### Start:

source .venv/bin/activate
uvicorn app.backend.main:app --reload

### Tests:

curl http://127.0.0.1:8000/health
curl http://127.0.0.1:8000/ontology/terms | head
curl -s -X POST http://127.0.0.1:8000/nl2sparql/draft -H "Content-Type: application/json" \
 -d '{"text":"zeige alle pfarrer"}'

## Hinweise

SPARQL-POST (Get auf /sparql kann 404 zeigen - ist normal)
Login: Nutzername admin, passwort admin.

## Installation und Start:

einmalig:
python3 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
pip install -r requirements.txt

starten:
uvicorn app.backend.main:app --reload

### Zum Starten von Docker Container wenn die Daten da sind:

cd ~/Documents/Bachelorarbeit-Programmierung/nl2sparql/infra
docker compose up -d
docker compose ps # STATUS should be "Up"
curl -i http://localhost:3030/$/server # -> 401 (ohne Login ist ok)
docker compose down
admin admin ist der login

### Zum Starten von Python:

cd ~/Documents/Bachelorarbeit-Programmierung/nl2sparql
source .venv/bin/activate
uvicorn app.backend.main:app --reload
muss man neues terminal aufmachen
