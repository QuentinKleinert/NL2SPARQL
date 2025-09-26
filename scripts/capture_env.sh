#!/usr/bin/env bash
set -euo pipefail

BASE="${NL2_BASE:-http://localhost:8080/api}"
OUT_DIR="evaluation"
mkdir -p "$OUT_DIR"

timestamp() { date -u +"%Y-%m-%dT%H:%M:%SZ"; }

# Git/SW-Stände
ROOT_SHA="$(git rev-parse HEAD 2>/dev/null || echo 'N/A')"
UI_SHA="$ROOT_SHA"
API_SHA="$ROOT_SHA"
# Wenn Backend als Submodul/Unterordner separat ist, hier anpassen:
# API_SHA="$(cd app/backend && git rev-parse HEAD 2>/dev/null || echo 'N/A')"

# Docker/Runtime
DOCKER_V="$(docker --version 2>/dev/null || echo 'docker N/A')"
COMPOSE_V="$(docker compose version 2>/dev/null || echo 'compose N/A')"

# Health
HEALTH_JSON="$OUT_DIR/health.json"
curl -s "$BASE/health" > "$HEALTH_JSON" || echo '{}' > "$HEALTH_JSON"

# Perf (15min Baseline)
PERF_JSON="$OUT_DIR/perf_15min.json"
curl -s "$BASE/metrics/perf?minutes=15" > "$PERF_JSON" || echo '{}' > "$PERF_JSON"

# Ontologie-Terme
TERMS_JSON="$OUT_DIR/ontology_terms.json"
curl -s "$BASE/ontology/terms" > "$TERMS_JSON" || echo '{}' > "$TERMS_JSON"

# Fuseki Reachability (optional, falls direkt erreichbar)
FUSEKI_OK="unknown"
if curl -sf "http://localhost:3030" >/dev/null; then
  FUSEKI_OK="reachable"
else
  FUSEKI_OK="unreachable"
fi

# Pseudonymisierung (aus Environment übernehmen; bitte im Backend .env setzen)
PSEUDO="${PSEUDONYMIZE_LOGS:-unknown}"

# .env Schnappschuss (ohne Secrets)
ENV_SAFE_FILE="$OUT_DIR/dotenv_safe.txt"
{
  echo "# Redacted .env snapshot ($(timestamp))"
  grep -E '^(PSEUDONYMIZE_LOGS|MODEL_NAME|OPENAI_MODEL|FUSEKI_.*|NL2_.*)=' .env 2>/dev/null \
    | sed -E 's/(OPENAI_.*=).+/\1***REDACTED***/'
} > "$ENV_SAFE_FILE" || true

# Zusammenfassung
ENV_JSON="$OUT_DIR/ENVIRONMENT.json"
jq -n --arg ts "$(timestamp)" \
      --arg base "$BASE" \
      --arg root_sha "$ROOT_SHA" \
      --arg api_sha "$API_SHA" \
      --arg ui_sha "$UI_SHA" \
      --arg docker_v "$DOCKER_V" \
      --arg compose_v "$COMPOSE_V" \
      --arg pseudo "$PSEUDO" \
      --arg fuseki "$FUSEKI_OK" \
      --slurpfile health "$HEALTH_JSON" \
      --slurpfile perf "$PERF_JSON" \
      --slurpfile terms "$TERMS_JSON" \
'{
  captured_at: $ts,
  base_url: $base,
  git: { root_sha: $root_sha, api_sha: $api_sha, ui_sha: $ui_sha },
  runtime: { docker: $docker_v, compose: $compose_v },
  pseudonymization: $pseudo,
  fuseki: $fuseki,
  health: ( $health[0] // {} ),
  perf_15min: ( $perf[0] // {} ),
  ontology_terms: ( $terms[0] // {} )
}' > "$ENV_JSON"

echo "✅ Snapshot geschrieben nach: $OUT_DIR/"
echo "   - $ENV_JSON"
echo "   - $HEALTH_JSON"
echo "   - $PERF_JSON"
echo "   - $TERMS_JSON"
echo "   - $ENV_SAFE_FILE"
