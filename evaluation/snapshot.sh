#!/usr/bin/env bash
set -euo pipefail

# --- Konfiguration ---
BASE="${NL2_BASE:-http://localhost:8080/api}"
OUT_DIR="evaluation"
RUNS_DIR="$OUT_DIR/nl_runs"
RUNS="${RUNS:-5}"             # Anzahl Wiederholungen, z.B. 5 oder 10
SELECT_LIMIT="${SELECT_LIMIT:-0}"  # 0 = ohne extra LIMIT injizieren

mkdir -p "$RUNS_DIR"

# --- 0) Environment/Perf-Snapshot (separates Script) ---
if [ -f "scripts/capture_env.sh" ]; then
  echo "→ Environment/Perf Snapshot…"
  bash scripts/capture_env.sh
else
  echo "⚠️  scripts/capture_env.sh nicht gefunden – überspringe Snapshot."
fi

# --- 1) Prompts (SELECT/UPDATE) ---
# Du kannst die Texte hier bei Bedarf anpassen:
PROMPTS_JSON='[
  {"id":"p1","kind":"SELECT","text":"Zeige 10 Pfarrer:innen …"},
  {"id":"p2","kind":"SELECT","text":"Zeige alle Pfarrer:innen aus „Musterstadt“"},
  {"id":"p3","kind":"UPDATE","text":"Füge Pfarrer „Anna Muster“ hinzu"},
  {"id":"p4","kind":"UPDATE","text":"Ändere Nachnamen … auf „Beispiel“"},
  {"id":"p5","kind":"UPDATE","text":"Lösche den Wohnort …"}
]'

# Hilfsfunktionen
jq_sparql='(.sparql // .data.sparql // .query // "")'

call_generate() {
  local txt="$1"
  curl -s -X POST "$BASE/nl2sparql/generate" \
    -H 'Content-Type: application/json' \
    -d "$(jq -n --arg t "$txt" '{text:$t}')" \
  || echo '{}'
}

call_select() {
  local sparql="$1"
  curl -s -X POST "$BASE/nl2sparql/select" \
    -H 'Content-Type: application/json' \
    -d "$(jq -n --arg q "$sparql" '{sparql:$q}')" \
  || echo '{}'
}

call_preview() {
  local sparql="$1"
  curl -s -X POST "$BASE/nl2sparql/preview" \
    -H 'Content-Type: application/json' \
    -d "$(jq -n --arg q "$sparql" '{sparql:$q}')" \
  || echo '{}'
}

call_execute() {
  local token="$1"
  curl -s -X POST "$BASE/nl2sparql/execute" \
    -H 'Content-Type: application/json' \
    -d "$(jq -n --arg t "$token" '{confirm_token:$t}')" \
  || echo '{}'
}

call_undo() {
  local undo_q="$1"
  curl -s -X POST "$BASE/nl2sparql/undo" \
    -H 'Content-Type: application/json' \
    -d "$(jq -n --arg q "$undo_q" '{undo_sparql:$q}')" \
  || echo '{}'
}

# --- 2) Mehrfachläufe NL→SPARQL ---
echo "→ Starte NL→SPARQL Läufe (RUNS=$RUNS) gegen $BASE …"
for r in $(seq 1 "$RUNS"); do
  RDIR="$RUNS_DIR/run_$r"
  mkdir -p "$RDIR"
  echo "  • Run $r → $RDIR"

  idx=0
  echo "$PROMPTS_JSON" | jq -c '.[]' | while read -r P; do
    idx=$((idx+1))
    pid=$(echo "$P" | jq -r '.id')
    kind=$(echo "$P" | jq -r '.kind')
    text=$(echo "$P" | jq -r '.text')

    # 2.1 Generate
    GEN_RAW="$(call_generate "$text")"
    SPARQL=$(echo "$GEN_RAW" | jq -r "$jq_sparql")

    # Optional: deterministisches LIMIT für SELECT hinzufügen (Varianz senken)
    if [ "$SELECT_LIMIT" != "0" ] && [ "$kind" = "SELECT" ]; then
      # ganz simpel anhängen, falls nicht vorhanden
      if ! grep -qiE '^\s*LIMIT\s+[0-9]+' <<<"$SPARQL"; then
        SPARQL="${SPARQL}"$'\n'"LIMIT ${SELECT_LIMIT}"
      fi
    fi

    # 2.2 Artefakt schreiben (inkl. Prompt-Metadaten & extrahierter SPARQL)
    FN_GEN="$RDIR/gen_${idx}.json"
    echo "$GEN_RAW" | jq --arg pid "$pid" --arg kind "$kind" --arg text "$text" \
        --arg q "$SPARQL" \
        '. as $resp | {
          run: '"$r"', prompt_id:$pid, kind:$kind, prompt:$text,
          response:$resp, sparql:$q
        }' > "$FN_GEN"

    # 2.3 SELECT-Probelauf nur für SELECT-Prompts
    if [ "$kind" = "SELECT" ]; then
      FN_SEL="$RDIR/select_${idx}.json"
      call_select "$SPARQL" > "$FN_SEL"
    fi
  done
done

# --- 3) Update-Pipeline (Preview → Execute → Undo) – Einmal-Test ---
# Wir nehmen beispielhaft Prompt p4 ("Ändere Nachnamen …")
echo "→ Teste Update-Pipeline (Preview→Execute→Undo) einmalig …"
SAMPLE_UPDATE=$(echo "$PROMPTS_JSON" | jq -r '.[] | select(.id=="p4") | .text')
PREVIEW_RAW="$(call_generate "$SAMPLE_UPDATE")"
PREVIEW_SPARQL=$(echo "$PREVIEW_RAW" | jq -r "$jq_sparql")

FN_PREVIEW="$OUT_DIR/run_preview.json"
FN_EXEC="$OUT_DIR/run_execute.json"
FN_UNDO="$OUT_DIR/run_undo.json"
FN_SELCHK="$OUT_DIR/select_check.json"

# Preview
PREVIEW_RES="$(call_preview "$PREVIEW_SPARQL")"
echo "$PREVIEW_RES" > "$FN_PREVIEW"

# Execute (Token aus Preview)
CONFIRM_TOKEN=$(echo "$PREVIEW_RES" | jq -r '.confirm_token // .token // ""')
if [ -n "$CONFIRM_TOKEN" ] && [ "$CONFIRM_TOKEN" != "null" ]; then
  EXEC_RES="$(call_execute "$CONFIRM_TOKEN")"
  echo "$EXEC_RES" > "$FN_EXEC"

  # optionaler SELECT-Check (wenn Execute eine Query/Graph liefert, kannst du hier eine SELECT-Query prüfen)
  echo '{"check":"(optional) – passe diesen Schritt bei Bedarf an"}' > "$FN_SELCHK"

  # Undo (falls Undo-Query zurückgegeben wurde)
  UNDO_Q=$(echo "$EXEC_RES" | jq -r '(.undo_sparql // .undoQuery // "")')
  if [ -n "$UNDO_Q" ] && [ "$UNDO_Q" != "null" ]; then
    UNDO_RES="$(call_undo "$UNDO_Q")"
    echo "$UNDO_RES" > "$FN_UNDO"
  else
    echo '{"info":"Kein undo_sparql in Execute-Antwort gefunden."}' > "$FN_UNDO"
  fi
else
  echo '{"error":"Kein confirm_token aus Preview erhalten."}' > "$FN_EXEC"
  echo '{"info":"Undo entfällt mangels Execute."}' > "$FN_UNDO"
fi

echo "✅ Fertig. Artefakte unter: $RUNS_DIR (pro Run) & $OUT_DIR/run_*.json"
