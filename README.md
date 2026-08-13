# AGIChat

Monorepo del widget embebible de chat para AGIChat.

## Estructura

```text
server/         Mock API con Elysia + Bun
packages/core/  Composable `useChat` y tipos compartidos
widget/         Vue 3 + `defineCustomElement` + `window.AGIChat`
CONTRACTS.md    Contrato entre capas
AGENTS.md       Reglas de colaboración y arquitectura
docs/           Notas de arquitectura y decisiones
```

