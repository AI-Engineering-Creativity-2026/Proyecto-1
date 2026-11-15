FROM oven/bun:1.4.2-alpine AS builder

WORKDIR /app

COPY package.json bun.lock ./
COPY packages/core/package.json packages/core/package.json
COPY packages/contracts/package.json packages/contracts/package.json
COPY packages/mcp-shared/package.json packages/mcp-shared/package.json
COPY server/package.json server/package.json
COPY servers/books-mcp/package.json servers/books-mcp/package.json
COPY servers/tmdb-mcp/package.json servers/tmdb-mcp/package.json
COPY widget/package.json widget/package.json

RUN bun install --frozen-lockfile

COPY packages/contracts packages/contracts
COPY packages/mcp-shared packages/mcp-shared
COPY servers/tmdb-mcp servers/tmdb-mcp

RUN bun build servers/tmdb-mcp/src/index.ts --outdir dist

FROM oven/bun:1.4.2-alpine

WORKDIR /app
COPY --from=builder /app/dist/index.js index.js
RUN chown -R bun:bun /app
USER bun

EXPOSE 3101
HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=5 \
  CMD ["bun", "-e", "fetch('http://localhost:3101/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"]

CMD ["bun", "index.js"]
