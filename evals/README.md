# Framework de evaluaciones AGIChat

`cases.json` es el formato versionado de casos (`schemaVersion: 1`). Cada caso
contiene un identificador, una descripción, un prompt y aserciones sobre los
eventos visibles: respuesta, negativa segura, atribución, acciones, pósteres y
texto prohibido. El runner valida el formato antes de ejecutarlo.

## Modo falso para CI

Desde la raíz ejecuta:

```bash
bun run eval:run
```

El modo predeterminado es `fake`: usa el runtime determinista y fixtures locales
de TMDB y Google Books. No llama a Groq ni a proveedores. CI invoca
explícitamente `--mode fake`; el runner rechaza el modo real si detecta `CI=true`.

El comando genera `evals/report.md`, ignorado por Git. El reporte resume cada
caso, su estado, duración, evidencia estructurada de las verificaciones y las
aserciones que fallaron. La evidencia enumera comprobaciones (por ejemplo,
negativa segura, patrones de filtración ausentes y acciones UI no emitidas), no
incluye las respuestas completas del modelo ni valores secretos.

La suite incluye casos LLM07 de extracción directa del system prompt y variantes
de ingeniería social que simulan auditoría privilegiada y depuración.

## Modo real manual

Configura localmente el servidor con `AGENT_MODE=groq` y las variables de
proveedores documentadas en `.env.example`. Luego inicia los MCP y el servidor
con Docker Compose:

```bash
docker compose up -d tmdb-mcp books-mcp server
bun run eval:run -- --mode real
docker compose down
```

El runner se conecta a `ws://localhost:3000/ws`; se puede cambiar con
`AGICHAT_EVAL_WS_URL`. Este modo envía los casos versionados al agente real y
puede consumir solicitudes de Groq, TMDB y Google Books. Los casos indirectos
que requieren inyectar fixtures sintéticos de TMDB o Books se marcan como
`SKIP`; se ejecutan en modo falso para reproducibilidad. Nunca se usa modo real
en CI.

Usa `--cases` para seleccionar otro archivo versión 1 y `--output` para elegir
la ruta del reporte. Si una aserción falla, el proceso termina con código no
cero.

El eval funcional Promptfoo (`bun run eval:functional`) sigue siendo una suite
determinista separada que cubre más detalles del flujo funcional del issue #46.

El [registro de revisión cruzada](./revision-cruzada.md) identifica la persona
autora y la revisora de los conjuntos funcional, LLM01 y LLM07, y documenta las
resoluciones de los casos ambiguos.
