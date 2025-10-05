#!/usr/bin/env bash
set -euo pipefail

OUT_FILE=${1:-vendor/dbpedia/sample.ttl}
FUSEKI_URL=${FUSEKI_URL:-http://localhost:3030/combined/data}
LOAD=${LOAD_FUSEKI:-0}

mkdir -p "$(dirname "$OUT_FILE")"

read -r -d '' QUERY <<'SPARQL'
PREFIX dbo: <http://dbpedia.org/ontology/>
PREFIX foaf: <http://xmlns.com/foaf/0.1/>
PREFIX dbr: <http://dbpedia.org/resource/>
CONSTRUCT {
  ?person a dbo:Cleric ;
          foaf:name ?name ;
          dbo:birthPlace ?birthPlace .
  ?birthPlace foaf:name ?placeName .
}
WHERE {
  ?person a dbo:Cleric ;
          foaf:name ?name ;
          dbo:birthPlace ?birthPlace .
  OPTIONAL { ?birthPlace foaf:name ?placeName }
}
LIMIT 50
SPARQL

printf 'Lade Beispiel-Daten aus DBpedia ...\n'
curl -sSf "https://dbpedia.org/sparql" \
  --data-urlencode "query=${QUERY}" \
  -H 'Accept: text/turtle' \
  -o "$OUT_FILE"

printf 'Beispieldatei geschrieben nach %s\n' "$OUT_FILE"

if [[ "$LOAD" = "1" ]]; then
  printf 'Importiere in Fuseki (%s) ...\n' "$FUSEKI_URL"
  curl -sSf -u "${FUSEKI_USER:-admin}:${FUSEKI_PASSWORD:-admin}" \
    -X POST -H "Content-Type: text/turtle" \
    --data-binary @"$OUT_FILE" \
    "$FUSEKI_URL"
  printf 'Import abgeschlossen.\n'
else
  printf 'Hinweis: Um automatisch zu importieren, setze LOAD_FUSEKI=1.\n'
fi
