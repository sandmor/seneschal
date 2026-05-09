FROM ghcr.io/astral-sh/uv:python3.11-bookworm-slim
WORKDIR /app

COPY pyproject.toml uv.lock ./
COPY backend/pyproject.toml backend/

RUN uv sync --frozen --no-dev

COPY backend/ backend/

ARG PORT=8000
ENV PORT=${PORT}
EXPOSE ${PORT}
CMD ["sh", "-c", "uv run --package backend uvicorn --app-dir backend src.main:app --host 0.0.0.0 --port ${PORT:-8000}"]