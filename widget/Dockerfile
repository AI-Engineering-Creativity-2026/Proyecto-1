FROM oven/bun:1.4.2-alpine

WORKDIR /app
COPY package.json bun.lock ./
COPY packages packages
COPY widget/package.json widget/package.json
COPY scripts scripts
RUN bun install --frozen-lockfile

COPY widget widget
RUN bun --cwd widget build

WORKDIR /app/widget
EXPOSE 4173
CMD ["bun", "run", "preview", "--", "--host", "0.0.0.0"]
