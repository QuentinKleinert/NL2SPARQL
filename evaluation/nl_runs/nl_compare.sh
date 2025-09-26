#!/usr/bin/env bash
set -euo pipefail

RUNS_DIR="${1:-evaluation/nl_runs}"
OUT_SUMMARY="$RUNS_DIR/summary.jsonl"
OUT_OVERVIEW="$RUNS_DIR/summary_overview.json"
OUT_VARIANTS="$RUNS_DIR/variants.json"
OUT_MODE="$RUNS_DIR/mode_share.json"
OUT_PSTATS="$RUNS_DIR/prompt_stats.json"

jq_sparql='(.sparql // .data.sparql // .query // "")'

# sha256 portable
sha256() {
  if command -v sha256sum >/dev/null 2>&1; then
    printf "%s" "$1" | sha256sum | awk '{print $1}'
  else
    printf "%s" "$1" | openssl dgst -sha256 | awk '{print $2}'
  fi
}

echo "→ Sammle gen_*.json → $OUT_SUMMARY"
: > "$OUT_SUMMARY"

# 1) Flatten: summary.jsonl (eine Zeile pro (run,prompt))
for d in "$RUNS_DIR"/run_*; do
  [ -d "$d" ] || continue
  run=$(basename "$d" | sed 's/run_//')
  for f in "$d"/gen_*.json; do
    [ -f "$f" ] || continue
    row="$(jq -c "{run:.run, prompt_id:.prompt_id, kind:.kind, prompt:.prompt, sparql:(.sparql // \"\")}" "$f")"
    s=$(echo "$row" | jq -r '.sparql')
    h=$(sha256 "$s")
    echo "$row" | jq --arg h "$h" '. + {sha256:$h}' >> "$OUT_SUMMARY"
  done
done

# 2) Varianten je Prompt
echo "→ Varianten je Prompt → $OUT_VARIANTS"
jq -s '
  group_by(.prompt_id) | map({
    prompt_id: .[0].prompt_id,
    kind: (.[0].kind),
    n: length,
    variants: ( group_by(.sha256) | map({hash: .[0].sha256, count: length}) | sort_by(-.count) ),
    uniq: ( group_by(.sha256) | length )
  })
' "$OUT_SUMMARY" > "$OUT_VARIANTS"

# 3) mode_share je Prompt
echo "→ mode_share je Prompt → $OUT_MODE"
jq '
  map({
    prompt_id,
    kind,
    n,
    uniq,
    mode_share: (
      if (.[0].n // 0) == 0 then 0
      else
        ( [ .variants[].count ] | max ) / ( .n | tonumber )
      end
    )
  })
' "$OUT_VARIANTS" > "$OUT_MODE"

# 4) kompakte Übersicht (für Tabelle)
echo "→ Übersicht → $OUT_OVERVIEW"
jq '
  map({
    prompt_id, kind, n,
    uniq,
    mode_share
  })
' "$OUT_MODE" > "$OUT_OVERVIEW"

# 5) Zusatzstatistik SELECT: Erfolg der Probeläufe (falls vorhanden)
# (Heuristik: wenn select_*.json existieren und ein .results.bindings-Feld hat)
echo "→ Prompt-Stats → $OUT_PSTATS"
jq -s '
  group_by(.prompt_id) | map({
    prompt_id: .[0].prompt_id,
    kind: (.[0].kind),
    n: length,
    uniq: ( group_by(.sha256) | length )
  })
' "$OUT_SUMMARY" > "$OUT_PSTATS"

echo "✅ Done:
  - $OUT_SUMMARY
  - $OUT_VARIANTS
  - $OUT_MODE
  - $OUT_OVERVIEW
  - $OUT_PSTATS"
