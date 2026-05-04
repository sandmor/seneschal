#!/usr/bin/env bash
# AI GENERATED
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
HOST="${HOST:-127.0.0.1}"
BACKEND_PORT="${BACKEND_PORT:-8000}"
FRONTEND_PORT="${FRONTEND_PORT:-5173}"
OPEN_BROWSER="${OPEN_BROWSER:-true}"
BACKEND_LOG="${BACKEND_LOG:-/tmp/seneschal-backend-dev.log}"
FRONTEND_LOG="${FRONTEND_LOG:-/tmp/seneschal-frontend-dev.log}"

cleanup() {
  if [[ -n "${FRONTEND_PID:-}" ]] && kill -0 "${FRONTEND_PID}" 2>/dev/null; then
    kill "${FRONTEND_PID}"
    wait "${FRONTEND_PID}" || true
  fi

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
  PUBLIC_FRONTEND_URL="http://${HOST}:3000" \
  uv run --package backend uvicorn --app-dir backend src.main:app --reload --host "${HOST}" --port "${BACKEND_PORT}"
) >"${BACKEND_LOG}" 2>&1 &
BACKEND_PID=$!

(
  cd "${ROOT_DIR}/frontend"
  VITE_PUBLIC_API_URL="http://${HOST}:${BACKEND_PORT}" \
  bun run dev -- --host "${HOST}" --port "${FRONTEND_PORT}"
) >"${FRONTEND_LOG}" 2>&1 &
FRONTEND_PID=$!

if ! wait_for_url "http://${HOST}:${BACKEND_PORT}/health"; then
  cat "${BACKEND_LOG}"
  exit 1
fi

if ! wait_for_url "http://${HOST}:${FRONTEND_PORT}"; then
  cat "${FRONTEND_LOG}"
  exit 1
fi

echo "Backend:  http://${HOST}:${BACKEND_PORT}"
echo "Frontend: http://${HOST}:${FRONTEND_PORT}"
echo "OpenAPI:  http://${HOST}:${BACKEND_PORT}/openapi.json"

if [[ "${OPEN_BROWSER}" == "true" ]] && command -v xdg-open >/dev/null 2>&1; then
  xdg-open "http://${HOST}:${FRONTEND_PORT}" >/dev/null 2>&1 || true
fi

echo ""
echo "Logs:"
echo "- ${BACKEND_LOG}"
echo "- ${FRONTEND_LOG}"

echo ""
echo "Press Ctrl+C to stop both services."

wait
