# NL2SPARQL – Natürlichsprachliche SPARQL-Workflows für die Pfarrerdatenbank

_End-to-end Plattform aus Bachelorarbeit von Quentin Kleinert: Von der Texteingabe über abgesicherte SPARQL-Updates bis zur Undo-Historie und Performance-Analyse._

---

## Inhalt

- [NL2SPARQL – Natürlichsprachliche SPARQL-Workflows für die Pfarrerdatenbank](#nl2sparql--natürlichsprachliche-sparql-workflows-für-die-pfarrerdatenbank)
  - [Inhalt](#inhalt)
  - [Warum dieses Projekt?](#warum-dieses-projekt)
  - [Funktionsumfang](#funktionsumfang)
  - [Systemarchitektur](#systemarchitektur)
  - [Verzeichnisüberblick](#verzeichnisüberblick)
  - [Voraussetzungen](#voraussetzungen)
  - [Schnellstart (Docker Compose)](#schnellstart-docker-compose)
  - [Lokale Entwicklung (UI/Backend separat)](#lokale-entwicklung-uibackend-separat)
    - [1. Fuseki (Docker, persistent)](#1-fuseki-docker-persistent)
    - [2. Python-Backend](#2-python-backend)
    - [3. UI im Dev-Modus](#3-ui-im-dev-modus)
  - [Daten laden](#daten-laden)
    - [Pfarrerdaten beziehen](#pfarrerdaten-beziehen)
    - [Beispiel-Datensätze (lokal; Fuseki muss laufen)](#beispiel-datensätze-lokal-fuseki-muss-laufen)
    - [DBpedia-Demodaten (optional)](#dbpedia-demodaten-optional)
  - [Arbeiten in der UI](#arbeiten-in-der-ui)
  - [Wichtige API-Endpunkte](#wichtige-api-endpunkte)
  - [API-Authentifizierung \& Rate-Limit](#api-authentifizierung--rate-limit)
  - [Tests \& Evaluation](#tests--evaluation)
    - [Python Tests](#python-tests)
    - [Evaluation \& Benchmarks](#evaluation--benchmarks)
  - [CI/CD](#cicd)
  - [Monitoring \& Logs](#monitoring--logs)
  - [Troubleshooting](#troubleshooting)
  - [Hinweise zu Daten \& Datenschutz](#hinweise-zu-daten--datenschutz)

---

## Warum dieses Projekt?

SPARQL ist mächtig, aber für Endanwender:innen schwer zugänglich. Diese Anwendung bietet ein Interface, in dem natürliche Sprache per LLM (OpenAI GPT-4.x) in validierte SPARQL-Updates übersetzt wird. Sicherheitsmechanismen wie Preview-Token, Changes-Graph, Undo, Pseudonymisierung der Logs und Explainability machen Änderungen nachvollziehbar und DSGVO-konform.

## Funktionsumfang

- **NL → SPARQL**: Guardrailed Prompting liefert Update- und SELECT-Queries mit Ontologie-Kontext.
- **Preview-Token & TTL**: Ohne Bestätigung kein Update. Token werden nach Editor-Änderungen ungültig.
- **Validate & Explain**: Ontologiecheck (Klassen/Properties) und semantische Zusammenfassung der Query.
- **Execute & Undo**: Updates landen im Changes-Graph, inverse Queries stehen für Undo bereit.
- **SELECT-Runner**: Tabellenansicht direkt in der UI.
- **Pseudonymisierte Logs**: Personenbezogene Literale werden beim Logging maskiert.
- **Performance-Monitoring**: HTTP- und Fuseki-Latenzen mit Perzentilen.
- **Evaluation-Skripte**: NL-Läufe, Snapshots, Benchmark-Reports.

## Systemarchitektur

```
[React UI (Vite + Tailwind)]
      │  /api
      ▼
[Nginx Reverse Proxy]
      │
      ▼
[FastAPI Backend]
      │   ├─ OpenAI Responses API
      │   └─ Apache Jena Fuseki (HTTP)
      │        └─ Dataset `combined`
      │             └─ Named Graph `urn:nl2sparql:changes` (Undo)
      ▼
Log-Dateien (JSON Lines + Perf)
```

- **web**: Nginx Container, liefert gebaute UI, proxyt `/api` → Backend.
- **api**: FastAPI Container mit Endpunkten für Generate/Preview/Execute/Select/Undo/Validate/Explain/Logs/Metrics.
- **fuseki**: Apache Jena Fuseki mit persistentem Volume `fuseki-data` (Dataset `combined`).

## Verzeichnisüberblick

| Pfad                   | Inhalt                                                                      |
| ---------------------- | --------------------------------------------------------------------------- |
| `ui/`                  | React + Vite Frontend (Tailwind, Axios, React Query)                        |
| `app/backend/`         | FastAPI-Anwendung, Router, Services (LLM, Fuseki, Validator, Pseudonymizer) |
| `infra/`               | Dockerfiles, Nginx-Konfiguration, Fuseki-Setup                              |
| `evaluation/`          | Skripte & Artefakte für Benchmarks, NL-Läufe, Snapshots                     |
| `scripts/`             | Hilfsskripte (z. B. `import_dbpedia_sample.sh`)                             |
| `docs/Setup.md`        | Ursprüngliche Setup-Notizen (Referenz)                                      |
| `vendor/pfarrerdaten/` | Platzhalter für vertrauliche RDF-Daten (nicht im Repo)                      |

## Voraussetzungen

| Komponente      | Version/Empfehlung                                  |
| --------------- | --------------------------------------------------- |
| macOS/Linux/WSL | getestet auf macOS Sonoma (Apple Silicon + Rosetta) |
| Docker Desktop  | ≥ 4.26                                              |
| Node.js & npm   | Node 20, npm 10 (für UI-Builds)                     |
| Python          | 3.11 (für Tests & Tools)                            |
| OpenAI API-Key  | Zugriff auf GPT-4.1-Mini (oder kompatibel)          |

> **Hinweis**: Sensible RDF-Datensätze gehören **nicht** ins Repo. Lege sie lokal unter `vendor/pfarrerdaten/` ab.

## Schnellstart (Docker Compose)

```bash
# 1. Repository klonen (Beispiel)
git clone https://github.com/<dein-account>/nl2sparql.git
cd nl2sparql

# 2. Environment vorbereiten (Root .env)
cat <<'ENV' > .env
FUSEKI_BASE_URL=http://fuseki:3030
FUSEKI_DATASET=combined
FUSEKI_USER=admin
FUSEKI_PASSWORD=admin

OPENAI_API_KEY=dein_openai_key
LLM_MODEL=gpt-4.1-mini
LLM_TEMPERATURE=0.2
LLM_MAX_OUTPUT_TOKENS=1200

CHANGES_GRAPH=urn:nl2sparql:changes
API_AUTH_TOKEN=dev-token
RATE_LIMIT_PER_MINUTE=120
RATE_LIMIT_BURST=30
ENABLE_PROMETHEUS_METRICS=1
PROMETHEUS_BEARER_TOKEN=${API_AUTH_TOKEN}
ENV

# 3 Deinen AI Key bei OPEN_AI_Key=... eintragen

# 4. UI für Produktion bauen
cd ui
npm ci
npm run build
cd ..

# 4. Compose-Stack hochfahren
docker compose up -d --build

# Stacks wieder stoppen
docker compose down
```

| Service          | URL                   | Login         |
| ---------------- | --------------------- | ------------- |
| UI               | http://localhost:8080 | –             |
| Fuseki Workbench | http://localhost:3030 | admin / admin |

|

Beim nächsten Start reicht `docker compose up -d`. Daten bleiben im Volume `fuseki-data` erhalten.

## Lokale Entwicklung (UI/Backend separat)

### 1. Fuseki (Docker, persistent)

```bash
# Infra-Verzeichnis
cd infra
# Fuseki allein starten
docker compose up -d fuseki
```

Die Konfiguration (`infra/config-runtime.ttl`) lädt das Dataset `combined`.

### 2. Python-Backend

```bash
cd nl2sparql
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
# .env im Repo-Root nutzen
uvicorn app.backend.main:app --reload
```

- API erreichbar unter `http://127.0.0.1:8000`
- `/docs` bietet OpenAPI UI.

### 3. UI im Dev-Modus

```bash
cd ui
npm install  # oder npm ci
# optional: lokale Env übernehmen
cp .env.example .env.local 2>/dev/null || true
npm run dev  # startet Vite auf http://localhost:5173
```

In der UI kann die Backend-Adresse (Standard `http://127.0.0.1:8000`) oben angepasst werden.

## Daten laden

### Pfarrerdaten beziehen

1. Lege ein temporäres Arbeitsverzeichnis an und klone das Forschungs-Repository (Internes GitHub-Repository; der Zugriff auf \texttt{pcp-on-web/pfarrerbuch-meta} ist projektintern geregelt.) :
   ```bash
   mkdir -p tmp
   git clone git-url tmp/pfarrerbuch-meta
   ```
2. Kopiere die benötigten Dumps (z. B. `meta-*.nt.gz`, `vocabulary.nt.gz`) und die Fuseki-Konfiguration (`config.ttl`) nach `vendor/pfarrerdaten/`.
3. Entferne das temporäre Verzeichnis wieder (`rm -rf tmp/pfarrerbuch-meta`), damit keine vertraulichen Daten im Projekt verbleiben.

### Beispiel-Datensätze (lokal; Fuseki muss laufen)

```bash
# N-Quads (Graphdaten)
gunzip -c vendor/pfarrerdaten/meta-combined.nq.gz \
| curl -u admin:${FUSEKI_PASSWORD:-admin} \
  -X POST -H "Content-Type: application/n-quads" \
  --data-binary @- \
  "http://localhost:3030/combined/data"

# Vokabular als Default Graph
gunzip -c vendor/pfarrerdaten/vocabulary.nt.gz \
| curl -u admin:${FUSEKI_PASSWORD:-admin} \
  -X POST -H "Content-Type: application/n-triples" \
  --data-binary @- \
  "http://localhost:3030/combined/data?default"
```

> Die originalen Pfarrerdaten sind aus rechtlichen Gründen nicht im Repository enthalten.

### DBpedia-Demodaten (optional)

```bash
# Nur herunterladen
./scripts/import_dbpedia_sample.sh vendor/dbpedia/sample.ttl

# Download + Direktimport nach Fuseki
LOAD_FUSEKI=1 FUSEKI_URL="http://localhost:3030/combined/data" ./scripts/import_dbpedia_sample.sh
```

## Arbeiten in der UI

0. **Top-Bar konfigurieren**: Backend-URL kontrollieren und API-Token (`x-api-key`) eintragen.
1. **Natürlichsprachliche Anfrage** eingeben (z. B. „Füge einen neuen Pfarrer …“).
2. **Generate** → LLM erzeugt SPARQL; Token wird automatisch erstellt.
3. **Optionale Anpassungen** im Editor vornehmen.
4. **Validate** & **Explain** prüfen Ontologie-Konformität und beschreiben das Update.
5. **Preview** erzeugt einen neuen Token und zeigt Validator/Explain an.
6. **Execute** führt das Update aus (nur gültiger Token, TTL siehe Badge). Undo-SQL wird im Log gespeichert.
7. **Undo** funktioniert für INSERT/DELETE DATA via Aktivitätslog.
8. **Run SELECT** führt Leseabfragen direkt aus.
9. **Performance-Panel** zeigt HTTP- und Fuseki-Latenzen (p50/p95/max) sowie Top-Endpunkte.

Weitere UI-Details:

- Token-Badge wechselt auf Warnfarbe (< 15 s Restzeit).
- Logs werden pseudonymisiert (konfigurierbar via `PSEUDONYMIZE_LOGS`).
- Ontologie-Panel listet die wichtigsten Klassen/Properties, die dem LLM bereitgestellt werden.

## Wichtige API-Endpunkte

| Route                     | Methode | Beschreibung                             |
| ------------------------- | ------- | ---------------------------------------- |
| `/health`                 | GET     | Heartbeat für UI/Monitoring              |
| `/nl2sparql/draft`        | POST    | Beispiel-Boilerplate pro Intent          |
| `/nl2sparql/generate`     | POST    | NL → SPARQL + Validation/Explain + Token |
| `/nl2sparql/preview`      | POST    | SPARQL → Validation/Explain + Token      |
| `/nl2sparql/execute`      | POST    | Führt Update mit Confirm-Token aus       |
| `/nl2sparql/select`       | POST    | SELECT/ASK → JSON                        |
| `/nl2sparql/undo`         | POST    | wendet gespeichertes Undo an             |
| `/nl2sparql/validate`     | POST    | Ontologie-Check                          |
| `/nl2sparql/explain`      | POST    | heuristische Explainability              |
| `/ontology/terms`         | GET     | Ontologie-Ausschnitt                     |
| `/logs/recent?limit=…`    | GET     | letzte Änderungen (JSON Lines)           |
| `/metrics/perf?minutes=…` | GET     | Aggregierte Latenzen + Top-Paths         |
| `/metrics/prometheus`     | GET     | Prometheus-kompatible Histogramme        |

## API-Authentifizierung & Rate-Limit

- Alle geschützten Endpunkte erwarten den Header `x-api-key` mit dem Wert aus `API_AUTH_TOKEN`.
- Entwicklungs-Token (`dev-token`) sollten vor Produktion ersetzt werden.
- Rate-Limits werden über `RATE_LIMIT_PER_MINUTE` (Requests/Minute) und `RATE_LIMIT_BURST` (Burst-Faktor) gesteuert.
- Die UI speichert Backend-URL und Token im Dev-Modus in `localStorage`; in Produktion wird der Token über `VITE_API_TOKEN` eingebettet.

```bash
curl -H "x-api-key: $API_AUTH_TOKEN" http://localhost:8000/metrics/perf
```

## Tests & Evaluation

### Python Tests

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r tests/requirements.txt
pytest -q app/backend/tests/test_flow.py
```

- Testflow: Preview → Execute → Undo + SELECT Smoke-Test.

### Evaluation & Benchmarks

- `evaluation/snapshot.sh` – sichert aktuelle Logs/Perf-Metriken.
- `evaluation/nl_runs/nl_compare.sh` – vergleicht mehrere NL-Generierungen.
- `python tools/perf_report.py` – erstellt Latenz-Report aus `perf.jsonl`.

> Falls Fuseki/LLM nicht erreichbar: Mit `.env` Dummy-Daten oder Mocking arbeiten.

## CI/CD

- GitHub Actions Workflow: `.github/workflows/ci.yml`
  - Schritte: UI Build (`npm ci && npm run build`), Backend-Abhängigkeiten (`pip install -r requirements.txt`), Unit-Tests (`pytest`).
  - Integrationstests (`tests/test_flow.py`) werden nur ausgeführt, wenn `RUN_INTEGRATION_TESTS=1` gesetzt ist.

## Monitoring & Logs

- **Änderungslog**: `app/backend/logs/changes.jsonl`
- **Performance**: `app/backend/logs/perf.jsonl`
- **Undo**: inverse Queries im Log, Undo-Status
- **Pseudonymisierung** steuerbar über Env:
  - `PSEUDONYMIZE_LOGS=1` (default) / `0`
  - `LOG_PSEUDO_SALT`, `LOG_PSEUDO_FIELDS`
- **Prometheus/Grafana (optional)**: `infra/monitoring/docker-compose.monitoring.yml`
  - Start: `docker compose -f docker-compose.yml -f infra/monitoring/docker-compose.monitoring.yml up -d`
  - Prometheus: http://localhost:9090 (Scrape-Target `api:8000/metrics/prometheus`)
  - Grafana: http://localhost:3000 (Default-Login `admin`/`admin`, via `GRAFANA_USER`, `GRAFANA_PASSWORD` überschreibbar)
  - Dashboards können die Histogramme `nl2sparql_http_request_duration_seconds` und `nl2sparql_fuseki_request_duration_seconds` verwenden.

## Troubleshooting

| Problem                       | Ursache                                                     | Lösung                                                                   |
| ----------------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------ |
| `Preview/Execute` liefert 500 | Fuseki nicht erreichbar                                     | Prüfen: `docker compose ps`, Fuseki-URL in `.env` (`http://fuseki:3030`) |
| 405 beim Datenimport          | falscher Endpoint                                           | Für Upload: `/combined/data`, für Queries: `/combined/sparql`            |
| LLM-Antwort ohne Codeblock    | Modell-Regeln verfehlt                                      | Erneut `Generate`, ggf. `LLM_TEMPERATURE` senken                         |
| Token „ungültig/abgelaufen“   | TTL überschritten oder Editor geändert                      | Erneut Preview oder Generate durchführen                                 |
| Ports 8080/8000/3030 belegt   | Alte Container laufen                                       | `docker compose down` + `docker ps -a`, dann `docker rm -f …`            |
| Fuseki Passwort vergessen     | Default in `.env` auf `admin` setzen und Compose neustarten |

## Hinweise zu Daten & Datenschutz

- Personenbezogene Daten werden vor dem Logging pseudonymisiert (`px-xxxx`).
- Literale zu Namen/Gemeinden werden heuristisch maskiert (auch ohne Anführungszeichen) und Personen-URIs werden auf `urn:pseudo:*` abgebildet.
- API-Token werden im Browser nur im Dev-Modus via `localStorage` gespeichert, in Produktion per Build-Env eingebettet; sie verlassen den Client ausschließlich in Form des `x-api-key`-Headers.
- Preview-Token haben eine TTL von 10 Minuten und werden beim Editieren der Query verworfen.
- Nur Ontologie + Beispielinstanzen werden an das LLM gegeben – keine vollständigen Personen-Daten.
- Für öffentliche Demos empfiehlt sich das Laden semantisch ähnlicher Daten aus **DBpedia** oder einem Dummy-Dataset.
- Vendor-Datasets (`vendor/pfarrerdaten/`) sind vertraulich und werden nicht versioniert; Quelle und Aktualisierungen findest du im Forschungs-Repository [`pcp-on-web/pfarrerbuch-meta`](https://github.com/pcp-on-web/pfarrerbuch-meta).

---
