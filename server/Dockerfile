FROM oven/bun:1.4.2-alpine AS builder

WORKDIR /app

# The lockfile lives at the monorepo root. Build the server and widget together.
COPY package.json bun.lock ./
COPY packages/core/package.json packages/core/package.json
COPY server/package.json server/package.json
COPY widget/package.json widget/package.json
RUN bun install --frozen-lockfile

COPY packages/core packages/core
COPY server/src server/src
COPY widget widget
COPY scripts scripts

RUN bun run build

FROM oven/bun:1.4.2-alpine

WORKDIR /app

COPY package.json bun.lock ./
COPY packages/core/package.json packages/core/package.json
COPY server/package.json server/package.json
COPY widget/package.json widget/package.json
RUN bun install --frozen-lockfile --production --filter @agichat/server

COPY --from=builder /app/server/dist server/dist
COPY --from=builder /app/widget/dist server/public

WORKDIR /app/server

EXPOSE 3000

CMD ["bun", "run", "dist/index.js"]
