# System Overview

Dieses Dokument beschreibt die Gesamtarchitektur der NL2SPARQL-Plattform und wie Backend, UI und Datenhaltung zusammenspielen.

## Zielsetzung

Die Anwendung übersetzt natürlichsprachliche Änderungswünsche in abgesicherte SPARQL-Updates. Fachanwender:innen erhalten damit eine nachvollziehbare, DSGVO-konforme Oberfläche für Änderungen an der Pfarrerdatenbank.

## Komponenten

- **UI (Vite + React + Tailwind)**: Single-Page-App mit Editoren, Preview/Execute-Fluss und Monitoring-Panels.
- **API (FastAPI)**: Endpunkte für Generate/Preview/Execute/Undo, Ontologie-Validierung, Explainability und Log-Abrufe.
- **Fuseki**: Apache Jena Fuseki als triple store mit Dataset `combined` und Named Graph `urn:nl2sparql:changes` für Undo.
- **Monitoring-Stack (optional)**: Prometheus + Grafana (siehe `infra/monitoring/`).
- **Vendor-Daten**: RDF-Dumps der Pfarrerdatenbank im Verzeichnis `vendor/pfarrerdaten/`.

## Laufzeitübersicht

```
[Browser UI] --HTTP--> [FastAPI Backend] --SPARQL--> [Fuseki]
        │                       │
        │                       ├── HTTP (OpenAI Responses API)
        │                       └── Log-Dateien (JSON Lines + Perf)
        └── /metrics            └── Prometheus (optional)
```

## Hauptablauf

1. Benutzer:in formuliert einen Wunsch in natürlicher Sprache.
2. Backend ruft das LLM auf, liefert SPARQL-Vorschlag, Explainability und Validierung.
3. Die UI zeigt einen Preview-Token mit TTL; Änderungen im Editor verwerfen den Token.
4. Ein bestätigtes Execute schreibt ins Changes-Graph und protokolliert Undo-Informationen.
5. Performance- und Änderungslogs landen in `app/backend/logs/*.jsonl`.
6. Optional kann Undo über gespeicherte inverse Queries ausgeführt werden.

## Build & Deploy

- **Docker Compose** liefert die drei Kernservices `web`, `api`, `fuseki`.
- Produktions-UI wird mit `npm run build` erzeugt und vom Nginx-Container ausgeliefert.
- `.env` am Repository-Root speist API- und Fuseki-Umgebungsvariablen in den Compose-Stack.

## Wichtige Ressourcen

| Datei/Verzeichnis | Beschreibung |
| ----------------- | ------------ |
| `docker-compose.yml` | Standard-Stack für UI, Backend und Fuseki |
| `infra/api.Dockerfile` | Build der FastAPI-Anwendung |
| `infra/web.Dockerfile` | Build der UI + Nginx |
| `infra/fuseki/` | Fuseki-Konfiguration + Persistenzvolumen |
| `docs/examples/` | Beispielantworten für Generate/Preview/Execute |

Weitere Details zu Backend und Datenverwaltung finden sich in `docs/backend.md` und `docs/data-handling.md`.
