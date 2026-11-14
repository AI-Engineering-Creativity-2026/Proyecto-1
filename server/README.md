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

### Selección del agente

`AGENT_MODE` acepta `mock` o `groq` y usa `mock` por defecto, también en tests y
CI. Para activar Groq configura `AGENT_MODE=groq`, `GROQ_API_KEY` y
`GROQ_MODEL`. `GROQ_BASE_URL` es opcional para endpoints compatibles. El
servidor falla al iniciar si se selecciona Groq y falta la credencial o el
modelo; nunca se registra el secreto.

### Clientes MCP

Los clientes usan `TMDB_MCP_URL` y `BOOKS_MCP_URL`, configurados en `.env.example`
con los nombres DNS `tmdb-mcp` y `books-mcp` de Docker Compose. El servidor y
ambos MCP servers deben compartir la red de Docker. Se conectan mediante el SDK
MCP oficial con transporte Streamable HTTP, validan entradas y respuestas con
`packages/contracts` y convierten fallos de transporte o respuestas inválidas
en errores seguros. Las pruebas inyectan invocadores respaldados por fixtures.
El modo `mock` no abre conexiones MCP.

### Credenciales locales

Los valores reales deben configurarse únicamente en un archivo `.env` local,
que está ignorado por Git. Groq usa las credenciales individuales de cada
integrante mediante `GROQ_API_KEY`, `GROQ_MODEL` y, si aplica, `GROQ_BASE_URL`.
TMDB separa `TMDB_API_READ_ACCESS_TOKEN` del `TMDB_API_KEY`. Google Books usa
`GOOGLE_BOOKS_API_KEY`. Nunca copies estos valores al repositorio, a issues ni
a los logs.

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
