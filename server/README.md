# AGIChat Server

Servidor Elysia/Bun que implementa el backend de **Mook — Selma (AGIChat)**. Soporta tanto el modo simulado (`AGENT_MODE=mock`) como el sistema multiagente real (`AGENT_MODE=groq`) conectado a servidores MCP independientes, sin persistir conversaciones ni contener lógica de presentación.

## Ejecutar

Desde la raíz del repositorio:

```bash
bun install
bun --cwd server dev
```

La aplicación escucha en `PORT` (`3000` por defecto). `ALLOWED_ORIGINS` acepta orígenes separados por comas; si se configura, las conexiones WebSocket de otros orígenes se rechazan. Consulta [`.env.example`](../.env.example) para una configuración local.

### Selección del agente (`AgentPort`)

El handler WebSocket se comunica exclusivamente con la interfaz `AgentPort` (`server/src/agents/agent.port.ts`):

- `AGENT_MODE=mock` (por defecto en tests y CI): ejecuta `MockAgent` sin llamadas externas.
- `AGENT_MODE=groq`: ejecuta `OrchestratorAgent` (con `MovieAgent` y `ComparisonAgent`) usando `GROQ_API_KEY` y `GROQ_MODEL`. `GROQ_BASE_URL` es opcional para endpoints compatibles. El servidor falla al iniciar si falta la credencial o el modelo; nunca se registra el secreto.
- `DEMO_FALLBACK_ON_RATE_LIMIT=true`: envuelve el agente principal con `DemoFallbackAgent` para responder consultas usando los MCP reales si Groq devuelve límite de cuota (`RATE_LIMITED`, `AGENT_RATE_LIMIT`) o `UPSTREAM_ERROR`.

### Clientes MCP

Los clientes (`server/src/mcp/mcp.clients.ts`) consumen `TMDB_MCP_URL` y `BOOKS_MCP_URL` mediante el SDK MCP oficial con transporte Streamable HTTP:

- En Docker Compose usan los nombres DNS internos (`http://tmdb-mcp:3101/mcp` y `http://books-mcp:3102/mcp`).
- En desarrollo local sin Docker apuntan a `http://localhost:3101/mcp` y `http://localhost:3102/mcp`.
- Valida entradas y respuestas con `packages/contracts` y convierte fallos de transporte o respuestas inválidas en errores seguros. Las pruebas inyectan invocadores respaldados por fixtures. El modo `mock` no abre conexiones MCP.

### Credenciales locales

Los valores reales deben configurarse únicamente en un archivo `.env` local (ignorado por Git):

- Groq: `GROQ_API_KEY`, `GROQ_MODEL` y `GROQ_BASE_URL` opcional.
- TMDB: `TMDB_API_READ_ACCESS_TOKEN` y `TMDB_API_KEY`.
- Google Books: `GOOGLE_BOOKS_API_KEY`.

Nunca copies estos valores al repositorio, a issues ni a los logs.

## Endpoints

- `GET /health`: devuelve `{ "service": "agichat-mock-api", "status": "ok" }`.
- `GET /api/quota`: devuelve el consumo diario y porcentaje de uso en tiempo real de Groq, TMDB y Google Books (sin exponer secretos).
- `WS /ws`: recibe mensajes `user_message` y emite `agent_typing`, `agent_message` o `error`.
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

El servidor valida cada mensaje con TypeBox antes de procesarlo. Una solicitud normal produce `agent_typing` y luego `agent_message` con Markdown crudo y metadatos opcionales (`poster_url`, `actions` para abrir IMDb/Google Books tras validar la allowlist). Si el contenido contiene `__force_error__`, produce `error` con el código `FORCED_ERROR`. Cualquier emisión inválida se registra en el servidor sin secretos y se sustituye por un error genérico.

Todos los eventos incluyen `conversationId` y un timestamp ISO 8601. Los tipos y esquemas compartidos viven en `packages/contracts`.

## Tests

```bash
bun --cwd server test
bun run test:server
bun run eval:run
```

Los tests del handler no esperan latencia real (`createApp({ latency: () => 0 })`) ni llaman a APIs externas.
