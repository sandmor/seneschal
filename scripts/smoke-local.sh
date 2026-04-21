#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
HOST="${HOST:-127.0.0.1}"
BACKEND_PORT="${BACKEND_PORT:-8000}"
FRONTEND_PORT="${FRONTEND_PORT:-3000}"
BACKEND_LOG="${BACKEND_LOG:-/tmp/seneschal-backend.log}"
FRONTEND_LOG="${FRONTEND_LOG:-/tmp/seneschal-frontend.log}"

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

"${ROOT_DIR}/scripts/run-orval.sh"

(
  cd "${ROOT_DIR}"
  PORT="${BACKEND_PORT}" \
  PUBLIC_FRONTEND_URL="http://${HOST}:${FRONTEND_PORT}" \
  uv run --package backend uvicorn --app-dir backend src.main:app --host "${HOST}" --port "${BACKEND_PORT}"
) >"${BACKEND_LOG}" 2>&1 &
BACKEND_PID=$!

if ! wait_for_url "http://${HOST}:${BACKEND_PORT}/health"; then
  cat "${BACKEND_LOG}"
  exit 1
fi

(
  cd "${ROOT_DIR}/frontend"
  PORT="${FRONTEND_PORT}" \
  INTERNAL_API_URL="http://${HOST}:${BACKEND_PORT}" \
  VITE_PUBLIC_API_URL="http://${HOST}:${BACKEND_PORT}" \
  bun run build

  PORT="${FRONTEND_PORT}" \
  INTERNAL_API_URL="http://${HOST}:${BACKEND_PORT}" \
  VITE_PUBLIC_API_URL="http://${HOST}:${BACKEND_PORT}" \
  bun run start
) >"${FRONTEND_LOG}" 2>&1 &
FRONTEND_PID=$!

if ! wait_for_url "http://${HOST}:${FRONTEND_PORT}/health"; then
  cat "${FRONTEND_LOG}"
  exit 1
fi

backend_users="$(curl --fail --silent "http://${HOST}:${BACKEND_PORT}/api/users")"
frontend_html="$(curl --fail --silent "http://${HOST}:${FRONTEND_PORT}/")"

grep -q '"Alice"' <<<"${backend_users}"
grep -q 'Welcome Home!' <<<"${frontend_html}"
