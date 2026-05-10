FROM ghcr.io/astral-sh/uv:python3.11-bookworm-slim AS openapi-spec
WORKDIR /app

COPY pyproject.toml uv.lock ./
COPY backend/pyproject.toml backend/
RUN uv sync --frozen --no-dev

COPY backend/ backend/
RUN PYTHONPATH=/app/backend uv run --package backend python -c "import json; from src.main import app; json.dump(app.openapi(), open('/app/openapi.json', 'w'), indent=2)"

FROM oven/bun:1 AS builder
WORKDIR /app

COPY package.json bun.lock ./
COPY frontend/package.json frontend/

RUN bun install

COPY --from=openapi-spec /app/openapi.json /app/openapi.json
COPY frontend/ frontend/
WORKDIR /app/frontend
RUN OPENAPI_URL=/app/openapi.json bun run api:generate
RUN bun run build

FROM oven/bun:1-alpine
WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/frontend/dist ./frontend/dist
COPY --from=builder /app/frontend/node_modules ./frontend/node_modules
COPY --from=builder /app/frontend/server.ts ./frontend/server.ts

WORKDIR /app/frontend

EXPOSE 3000
CMD ["bun", "run", "server.ts"]
