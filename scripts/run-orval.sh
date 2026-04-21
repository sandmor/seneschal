#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
HOST="${HOST:-127.0.0.1}"
BACKEND_PORT="${BACKEND_PORT:-8000}"
BACKEND_LOG="${BACKEND_LOG:-/tmp/seneschal-orval-backend.log}"

cleanup() {
  if [[ -n "${BACKEND_PID:-}" ]] && kill -0 "${BACKEND_PID}" 2>/dev/null; then
    kill "${BACKEND_PID}"
    wait "${BACKEND_PID}" || true
  fi
}

wait_for_url() {
  local url="$1"

  for _ in $(seq 1 30); do
    if curl --fail --silent "${url}" >/dev/null; then
      return 0
    fi

    sleep 1
  done

  return 1
}

trap cleanup EXIT

(
  cd "${ROOT_DIR}"
  PORT="${BACKEND_PORT}" \
  uv run --package backend uvicorn --app-dir backend src.main:app --host "${HOST}" --port "${BACKEND_PORT}"
) >"${BACKEND_LOG}" 2>&1 &
BACKEND_PID=$!

if ! wait_for_url "http://${HOST}:${BACKEND_PORT}/openapi.json"; then
  cat "${BACKEND_LOG}"
  exit 1
fi

(
  cd "${ROOT_DIR}/frontend"
  OPENAPI_URL="http://${HOST}:${BACKEND_PORT}/openapi.json" bun run api:generate
)
