# Data Handling

Diese Dokumentation beschreibt den Umgang mit RDF-Daten, Logs und Evaluationsartefakten innerhalb des Projekts.

## Datenquellen

- **Pfarrerdatenbank**: Offizielle Dumps im Projekt deiner Professorin [`pcp-on-web/pfarrerbuch-meta`](https://github.com/pcp-on-web/pfarrerbuch-meta).
- **Ontologie / Vocabulary**: Ebenfalls aus dem o. g. Repository; notwendig für Klassifikationen und Explainability.
- **Demodaten**: Script `scripts/import_dbpedia_sample.sh` lädt DBpedia-Tripel für Tests ohne vertrauliche Inhalte.

## Ablage im Repository

| Ordner | Inhalt | Versioniert? |
| ------ | ------ | ------------- |
| `vendor/pfarrerdaten/` | lokal eingespielte Dumps (`meta-*.nt.gz`, `vocabulary.nt.gz`, `config.ttl`) | 🔒 Nein, per `.gitignore` ausgeschlossen |
| `app/backend/logs/` | Laufzeit-Logs (`changes.jsonl`, `perf.jsonl`) | 🔒 Nein, außer `.gitkeep` |
| `evaluation/` | Ergebnisdateien aus Testläufen und Benchmarks | teilweise (Whitelist in `.gitignore`) |
| `docs/examples/` | Beispielantworten von API-Endpunkten | ✅ Ja |

## Vorgehen für Pfarrerdaten

1. Repository der Professorin klonen (`docs/system-overview.md` verweist auf die Befehle).
2. Benötigte Dumps kopieren und lokal unter `vendor/pfarrerdaten/` ablegen.
3. Sicherstellen, dass vertrauliche Daten nicht eingecheckt werden (`git status` prüfen).
4. Bei Aktualisierungen alte Dumps entfernen/archivieren und neue Versionen einspielen.

## Import nach Fuseki

- Für `meta-combined.nq.gz` den Endpoint `/combined/data` verwenden.
- Vocabulary-Dateien per Default Graph (`?default`) importieren.
- Die Fuseki-Konfiguration kann mit `vendor/pfarrerdaten/config.ttl` ergänzt werden, falls mehrere Services benötigt werden.

## Umgang mit Logs

- Log-Pfade sind via Docker-Volume (`./app/backend/logs`) gemappt.
- Für DSGVO-konforme Speicherung wird Pseudonymisierung empfohlen (`PSEUDONYMIZE_LOGS=1`).
- Backups lassen sich über `infra/fuseki/backups/` oder externe Tools realisieren.

## Evaluation & Benchmarks

- Skripte in `evaluation/` erzeugen JSON/JSONL-Dateien; `.gitignore` trackt nur ausgewählte Übersichten.
- Aggregierte Ergebnisse (`summary_overview.json`, `mode_share.json`, `prompt_stats.json`) bleiben versioniert, um Vergleiche zwischen Runs zu ermöglichen.
- Größere Dumps oder Rohlogs sollten lokal bleiben oder in Artefakt-Storages ausgelagert werden.

## Beispielartefakte

- `docs/examples/generate-response.json`
- `docs/examples/preview-response.json`
- `docs/examples/execute-response.json`

Die Dateien dienen als Referenz für API-Verträge und können bei Dokumentationen oder Tests herangezogen werden.
