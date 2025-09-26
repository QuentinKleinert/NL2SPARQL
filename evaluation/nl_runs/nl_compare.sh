#!/usr/bin/env bash
set -euo pipefail

API="${API:-http://localhost:8080/api}"
OUT_DIR="evaluation/nl_runs"
mkdir -p "$OUT_DIR"
RUNS="${RUNS:-5}"

PROMPTS=(
  'Zeige 10 Pfarrer:innen mit Vor- und Nachnamen.'
  'Zeige alle Pfarrer:innen aus Gemeinde "Musterstadt".'
  'Füge einen neuen Pfarrer mit Vorname "Anna" und Nachname "Muster" hinzu.'
  'Ändere den Nachnamen von <urn:example:person:1> auf "Beispiel".'
  'Lösche den Wohnort der Ressource <urn:example:person:1>.'
)

ts(){ date -u +"%Y-%m-%dT%H:%M:%SZ"; }

RUN_SUMMARY="$OUT_DIR/summary.jsonl"
: > "$RUN_SUMMARY"

i=0
for prompt in "${PROMPTS[@]}"; do
  i=$((i+1)); base="$OUT_DIR/run_${i}"; mkdir -p "$base"
  echo "## Prompt $i: $prompt"

  for ((j=1; j<=RUNS; j++)); do
    res="$base/gen_${j}.json"
    sel_res="$base/select_${j}.json"

    if [ -s "$res" ]; then
      echo "  – gen_${j}.json vorhanden, skip"
      sparql=$(jq -r '.sparql // ""' "$res")
      if echo "$sparql" | tr '[:lower:]' '[:upper:]' | grep -Eq '(^|[^A-Z])(SELECT|ASK)\b'; then
        [ -s "$sel_res" ] || curl -s "$API/nl2sparql/select" \
           -H 'content-type: application/sparql-query' --data-binary "$sparql" > "$sel_res" || true
      fi
    else
      curl -s "$API/nl2sparql/generate" \
        -H 'content-type: application/json' \
        -d "$(jq -n --arg t "$prompt" '{text:$t}')" \
        > "$res"
      sleep 0.3
    fi

    ok=$(jq -r '.ok' "$res")
    sparql=$(jq -r '.sparql // ""' "$res")
    valid=$(jq -r '.validation.ok // false' "$res")
    model=$(jq -r '.model // "unknown"' "$res")
    hash=$(printf '%s' "$sparql" | shasum -a 256 | awk '{print $1}')

    is_select=false; sel_ok="n/a"
    if echo "$sparql" | tr '[:lower:]' '[:upper:]' | grep -Eq '(^|[^A-Z])(SELECT|ASK)\b'; then
      is_select=true
      if [ ! -s "$sel_res" ]; then
        curl -s "$API/nl2sparql/select" \
          -H 'content-type: application/sparql-query' \
          --data-binary "$sparql" > "$sel_res" || true
        sleep 0.2
      fi
      sel_ok=$(jq -r '.ok // false' "$sel_res" 2>/dev/null || echo "false")
    fi

    jq -n \
      --arg ts "$(ts)" \
      --arg prompt "$prompt" \
      --arg model "$model" \
      --argjson ok $([ "$ok" = "true" ] && echo true || echo false) \
      --argjson valid $([ "$valid" = "true" ] && echo true || echo false) \
      --argjson is_select $([ "$is_select" = true ] && echo true || echo false) \
      --arg sel_ok "$sel_ok" \
      --arg sparql "$sparql" \
      --arg hash "$hash" \
      '{
        ts:$ts, prompt:$prompt, model:$model,
        ok:$ok, valid:$valid, is_select:$is_select,
        select_ok: (if $sel_ok=="true" then true elif $sel_ok=="n/a" then "n/a" else false end),
        sparql:$sparql, sha256:$hash
      }' >> "$RUN_SUMMARY"
  done

  echo "— Auswertung Prompt $i —"
  awk '{print}' "$RUN_SUMMARY" \
  | jq -r --arg p "$prompt" 'select(.prompt==$p) | .sha256' \
  | sort | uniq -c
done

echo "✅ Fertig. Ergebnisse: $RUN_SUMMARY"
