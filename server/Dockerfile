FROM oven/bun:1.2.13-alpine

WORKDIR /app

# The lockfile lives at the monorepo root; install only the server workspace.
COPY package.json bun.lock ./
COPY packages/core/package.json packages/core/package.json
COPY server/package.json server/package.json
COPY widget/package.json widget/package.json
RUN bun install --frozen-lockfile --production --filter @agichat/server

COPY server/src server/src

WORKDIR /app/server

EXPOSE 3000

CMD ["bun", "run", "src/index.ts"]
