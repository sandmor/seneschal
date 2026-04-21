# Seneschal

## Requirements

- Python 3.11+
- `uv`
- Bun `1.3.6+`
- Docker and Docker Compose for containerized runs

## Environment

Create a local environment file before running anything:

```bash
cp .env.example .env
```

Default ports:

- Frontend: `3000`
- Backend: `8000`

## Setup Without Docker

Install Python and frontend dependencies:

```bash
uv sync
bun install
```

Generate the Orval client from the running backend schema:

```bash
bun run orval
```

## Run Without Docker

Start the backend in one terminal:

```bash
PUBLIC_FRONTEND_URL=http://127.0.0.1:3000 \
uv run --package backend uvicorn --app-dir backend src.main:app --reload --host 127.0.0.1 --port 8000
```

Build and start the frontend SSR server in a second terminal:

```bash
cd frontend
INTERNAL_API_URL=http://127.0.0.1:8000 \
VITE_PUBLIC_API_URL=http://127.0.0.1:8000 \
bun run build

INTERNAL_API_URL=http://127.0.0.1:8000 \
VITE_PUBLIC_API_URL=http://127.0.0.1:8000 \
bun run start
```

Open:

- Frontend: `http://127.0.0.1:3000`
- Backend OpenAPI: `http://127.0.0.1:8000/openapi.json`

If you just want the verified local smoke path instead of starting both processes manually:

```bash
bun run smoke
```

## Run With Docker

Build and start both services:

```bash
docker compose up --build
```

Run the Docker smoke test used by CI:

```bash
bun run smoke:docker
```

Stop the stack:

```bash
docker compose down --volumes --remove-orphans
```

## Formatting And Linting

Formatting is required and enforced in CI:

```bash
bun run format
bun run format:check
```

Linting is intentionally light-touch and focuses on correctness:

- Python: `ruff check`
- Frontend: TypeScript type-checking

Run both:

```bash
bun run lint
```
