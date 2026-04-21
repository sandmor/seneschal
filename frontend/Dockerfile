FROM oven/bun:1 as builder
WORKDIR /app

COPY package.json bun.lock ./
COPY frontend/package.json frontend/

RUN bun install

COPY frontend/ frontend/
WORKDIR /app/frontend
RUN bun run build

# Production Stage
FROM oven/bun:1-alpine
WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/frontend/dist ./frontend/dist
COPY --from=builder /app/frontend/node_modules ./frontend/node_modules
COPY --from=builder /app/frontend/server.ts ./frontend/server.ts

WORKDIR /app/frontend

EXPOSE 3000
CMD ["bun", "run", "server.ts"]
