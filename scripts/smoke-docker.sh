#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
HOST="${HOST:-127.0.0.1}"
BACKEND_PORT="${BACKEND_PORT:-8000}"
FRONTEND_PORT="${FRONTEND_PORT:-3000}"

wait_for_url() {
  local url="$1"

  for _ in $(seq 1 40); do
    if curl --fail --silent "${url}" >/dev/null; then
      return 0
    fi

    sleep 2
  done

  return 1
}

cleanup() {
  cd "${ROOT_DIR}"
  docker compose down --volumes --remove-orphans
}

trap cleanup EXIT

cd "${ROOT_DIR}"
docker compose up --build -d

if ! wait_for_url "http://${HOST}:${BACKEND_PORT}/health"; then
  docker compose logs backend
  exit 1
fi

if ! wait_for_url "http://${HOST}:${FRONTEND_PORT}/health"; then
  docker compose logs frontend
  exit 1
fi

backend_users="$(curl --fail --silent "http://${HOST}:${BACKEND_PORT}/api/users")"
frontend_html="$(curl --fail --silent "http://${HOST}:${FRONTEND_PORT}/")"

grep -q '"Alice"' <<<"${backend_users}"
grep -q 'Welcome Home!' <<<"${frontend_html}"
