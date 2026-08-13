# Architecture

The repository is organized as a Bun workspace monorepo.

- `server/` owns the mock WebSocket API and TypeBox schemas.
- `packages/core/` owns the `useChat` composable and shared domain types.
- `widget/` owns the Vue custom element and the public `window.AGIChat` API.

`CONTRACTS.md` is the source of truth for cross-layer interfaces.
