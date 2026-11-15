FROM oven/bun:1.4.2-alpine

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

COPY packages packages
COPY widget widget
COPY scripts scripts

ARG VITE_AGICHAT_API_URL=ws://localhost:3000/ws
ENV VITE_AGICHAT_API_URL=${VITE_AGICHAT_API_URL}

RUN bun --cwd widget build

RUN chown -R bun:bun /app
USER bun

WORKDIR /app/widget
EXPOSE 4173
HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=5 \
  CMD ["bun", "-e", "fetch('http://localhost:4173/').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"]

CMD ["bun", "run", "preview", "--", "--host", "0.0.0.0"]
