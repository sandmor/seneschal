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

Default storage:

- Backend data directory: `./data` locally, `/app/data` in Docker
- Auth route: `http://127.0.0.1:3000/auth`

Default auth credentials:

- Username: `admin`
- Password: `admin123`
- Override with `ADMIN_USERNAME` and `ADMIN_PASSWORD` in `.env`

## Authentication

The backend uses stateless JWT bearer tokens. On login, the backend returns a token that the frontend stores in `localStorage` and sends on every request via the `Authorization` header.

- Set `JWT_SECRET_KEY` in `.env`. If omitted, a random key is generated on startup (this invalidates all existing tokens on restart).
- Tokens expire after 10 minutes.
- The default `admin` account is a superadmin that exists independently of the database. Additional users and roles can be managed through the admin console once logged in.

## Logging

The backend writes structured logs to both stdout and rotating files.

- Log directory: `./logs` locally, `/app/logs` in Docker (persisted via the `backend-logs` volume)
- Rotation: 10 MB per file, 5 backups retained
- Every request is tagged with a correlation ID (`X-Request-ID`) that appears in all log lines for that request
- Adjust verbosity with `LOG_LEVEL` (default `INFO`)

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

## Development Without Docker

Use the repo-level development commands from the project root:

```bash
bun run dev
```

That starts:

- FastAPI with auto-reload on `http://127.0.0.1:8000`
- Express frontend server on `http://127.0.0.1:3000`
- Vite build watchers for the client and SSR bundles

If you only want one side:

```bash
bun run dev:backend
bun run dev:frontend
```

Open:

- Frontend: `http://127.0.0.1:3000`
- Auth page: `http://127.0.0.1:3000/auth`
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

Linting enforces naming conventions and correctness for both languages:

- **Python** (`ruff check`): classes must be `PascalCase`; functions, methods, and variables must be `snake_case`
- **Frontend** (`eslint` + `tsc`): types, interfaces, and React components must be `PascalCase`; functions and variables must be `camelCase`; constants may be `UPPER_CASE`.
- **Files** (`ls-lint` via `bun run lint:files`): frontend source files in `frontend/src` must use `kebab-case`; backend Python modules in `backend/src` must use `snake_case`.

Auto-generated code and framework-reserved names (for example TanStack Router's `__root.tsx`) are excluded where needed through `.ls-lint.yml`.

Run both:

```bash
bun run lint
```
