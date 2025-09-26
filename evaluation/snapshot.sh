#!/usr/bin/env bash
set -euo pipefail

BASE="${NL2_BASE:-http://localhost:8080/api}"

# immer relativ zum Repo-Root arbeiten, egal wo das Skript aufgerufen wird
REPO_ROOT="$(cd "$(dirname "$0")/.."; pwd)"
OUT_DIR="$REPO_ROOT/evaluation"
mkdir -p "$OUT_DIR"

timestamp() { date -u +"%Y-%m-%dT%H:%M:%SZ"; }

ROOT_SHA="$(git -C "$REPO_ROOT" rev-parse HEAD 2>/dev/null || echo 'N/A')"
UI_SHA="$ROOT_SHA"
API_SHA="$ROOT_SHA"

DOCKER_V="$(docker --version 2>/dev/null || echo 'docker N/A')"
COMPOSE_V="$(docker compose version 2>/dev/null || echo 'compose N/A')"

HEALTH_JSON="$OUT_DIR/health.json"
curl -s "$BASE/health" > "$HEALTH_JSON" || echo '{}' > "$HEALTH_JSON"

PERF_JSON="$OUT_DIR/perf_15min.json"
curl -s "$BASE/metrics/perf?minutes=15" > "$PERF_JSON" || echo '{}' > "$PERF_JSON"

TERMS_JSON="$OUT_DIR/ontology_terms.json"
curl -s "$BASE/ontology/terms" > "$TERMS_JSON" || echo '{}' > "$TERMS_JSON"

FUSEKI_OK="unknown"
if curl -sf "http://localhost:3030" >/dev/null; then
  FUSEKI_OK="reachable"
else
  FUSEKI_OK="unreachable"
fi

PSEUDO="${PSEUDONYMIZE_LOGS:-unknown}"

ENV_SAFE_FILE="$OUT_DIR/dotenv_safe.txt"
{
  echo "# Redacted .env snapshot ($(timestamp))"
  grep -E '^(PSEUDONYMIZE_LOGS|LLM_MODEL|FUSEKI_.*|NL2_.*|OPENAI_.*)=' "$REPO_ROOT/.env" 2>/dev/null \
    | sed -E 's/(OPENAI_.*=).+/\1***REDACTED***/'
} > "$ENV_SAFE_FILE" || true

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
