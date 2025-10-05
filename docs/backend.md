# Backend Guide

Dieser Leitfaden beschreibt Aufbau, Konfiguration und Erweiterung des FastAPI-Backends.

## Technologie-Stack

- **Python 3.11** (siehe `requirements.txt`)
- **FastAPI + Uvicorn** als Web-Framework
- **HTTPX** für REST-Aufrufe (OpenAI, Fuseki)
- **rdflib / SPARQLWrapper** für RDF-Verarbeitung
- **Prometheus Client** zur Exposition von Metriken

## Einstiegspunkte

| Pfad | Zweck |
| ---- | ----- |
| `app/backend/main.py` | erstellt die FastAPI-App, hängt Router und Middleware ein |
| `app/backend/config.py` | Pydantic Settings (Env-Unterstützung für Fuseki, OpenAI, Logging) |
| `app/backend/routers/*.py` | API-Router für NL2SPARQL-Fluss, Logs, Metrics, Ontologie |
| `app/backend/services/*.py` | Fachlogik (LLM, SPARQL, Pseudonymisierung, Monitoring) |
| `app/backend/tests/` | pytest-Suite für Flow-, Explain- und Security-Checks |

## Konfigurationsvariablen

Alle Einstellungen kommen aus `.env` oder Docker-Umgebungsvariablen.

- `FUSEKI_BASE_URL`, `FUSEKI_DATASET`, `FUSEKI_USER`, `FUSEKI_PASSWORD`
- `OPENAI_API_KEY`, `LLM_MODEL`, `LLM_TEMPERATURE`, `LLM_MAX_OUTPUT_TOKENS`
- `CHANGES_GRAPH`, `API_AUTH_TOKEN`, `ENABLE_PROMETHEUS_METRICS`
- Optionale Flags: `PSEUDONYMIZE_LOGS`, `LOG_PSEUDO_SALT`, `LOG_PSEUDO_FIELDS`

## Router & Services

- `routers/nl2sparql.py`: Generate → Preview → Execute → Undo Workflow
- `routers/logs.py`: liefert Change-/Performance-Logs als JSON Lines
- `routers/metrics.py`: HTTP- und Fuseki-Latenzen; Prometheus-Endpunkt
- `routers/ontology.py` & `routers/kps.py`: Ontologie- und KPS-spezifische Exporte
- Neue Router lassen sich analog registrieren – `main.py` importiert alle Router in `include_router(...)`-Aufrufen.

Services kapseln externe Integrationen:

- `services/llm.py`: Prompting, Guardrails, Error-Handling
- `services/sparql.py`: HTTP-Kommunikation mit Fuseki, Named Graph Verwaltung
- `services/pseudonymizer.py`: Hashing/Masking sensibler Literale
- `services/metrics.py` & `services/monitoring.py`: Messung, Aggregation, Prometheus
- `services/security.py`: Token-Prüfung & Rate-Limit-Hooks

## Logging & Persistenz

- JSON-Lines-Dateien unter `app/backend/logs/`
  - `changes.jsonl`: Audit-Log mit Undo-Payloads
  - `perf.jsonl`: Response-Zeiten (p50/p95/max) je Endpoint
- Direkt im Docker-Compose sind diese Pfade als Volume gemountet, damit Logs außerhalb des Containers verfügbar bleiben.

## Tests

Pytest-Befehle siehe README. Zusätzlich gibt es spezialisierte Suites:

- `test_explain.py`, `test_validator.py`: Validieren Explainability und Ontologieprüfungen
- `test_pseudonymizer.py`, `test_security.py`: Datenschutz & Authentifizierung
- `test_monitoring.py`: überprüft Prometheus-Pfade

Die Abhängigkeiten für Tests sind in `tests/requirements.txt` aufgeführt. Integrationstests erwarten laufendes Fuseki und ggf. einen Mock für die OpenAI-Schnittstelle.

## Erweiterungstipps

- Neue Services als Klassen/Funktionen in `services/` platzieren und per Dependency Injection (`Depends`) einhängen.
- Für zusätzliche Persistenz (z. B. Postgres) dedizierte Konfigurationssektionen in `config.py` ergänzen.
- CLI- oder Batchjobs können unter `app/backend/tools/` abgelegt werden.

Weitere Hinweise zur Datenhaltung stehen in `docs/data-handling.md`.
