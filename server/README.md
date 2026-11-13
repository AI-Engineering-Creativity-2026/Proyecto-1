# AGIChat Mock API

Servidor Elysia/Bun que implementa el backend simulado del widget AGIChat. No
persiste conversaciones ni contiene lógica de presentación.

## Ejecutar

Desde la raíz:

```bash
bun install
bun --cwd server dev
```

La aplicación escucha en `PORT` (3000 por defecto). `ALLOWED_ORIGINS` acepta
orígenes separados por comas; si se configura, las conexiones WebSocket de
otros orígenes se rechazan. Consulta `.env.example` para una configuración
local.

## Endpoints

- `GET /health`: devuelve `{ "service": "agichat-mock-api", "status": "ok" }`.
- `WS /ws`: recibe mensajes `user_message` y emite eventos del agente.
- `GET /` y rutas estáticas: sirven la preview construida cuando existe.

## Protocolo WebSocket

El cliente envía JSON con esta forma:

```json
{
  "type": "user_message",
  "conversationId": "conversation-1",
  "content": "Hola",
  "timestamp": "2026-08-13T10:00:00.000Z"
}
```

El servidor valida cada mensaje antes de enviarlo. Una solicitud normal produce
`agent_typing` y, después de una latencia aleatoria de 500–2000 ms,
`agent_message` con Markdown crudo. Si el contenido contiene `__force_error__`,
produce `error` con el código `FORCED_ERROR`. Cualquier emisión inválida se
registra en el servidor y se sustituye por un error genérico.

Todos los eventos incluyen `conversationId` y un timestamp ISO 8601. Los tipos
y esquemas compartidos viven en `packages/contracts`.

## Tests

```bash
bun --cwd server test
bun run test:server
```

Los tests del handler no esperan latencia real. La aplicación acepta una función
`latency` en `createApp({ latency: () => 0 })` para que las pruebas de integración
puedan fijar el retraso de forma determinista.
