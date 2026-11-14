# tmdb-mcp

Servidor MCP de películas para AGIChat. Expone Streamable HTTP mediante el
SDK oficial `@modelcontextprotocol/sdk` y no contiene lógica del Orquestador.

## Herramientas

- `search_movies({ query, year? })`
- `get_movie_details({ movieId })`
- `get_recommendations({ movieId })`

Las respuestas tienen la forma de `CONTRACTS.md`. `overview` y los nombres de
géneros son datos de terceros no confiables y se limitan a una longitud
máxima; nunca se usan para construir URLs. Las URLs de póster se construyen
con la configuración de TMDB y solo se aceptan `https://image.tmdb.org`.

## Variables

| Variable | Default | Descripción |
| --- | --- | --- |
| `TMDB_MCP_PORT` | `3101` | Puerto HTTP del servicio. |
| `TMDB_API_READ_ACCESS_TOKEN` | vacío | Token Bearer de lectura de TMDB. |
| `TMDB_API_KEY` | vacío | API Key alternativa de TMDB. |
| `TMDB_API_LANGUAGE` | `es-MX` | Idioma de resultados. |
| `TMDB_UPSTREAM_TIMEOUT_MS` | `10000` | Timeout de cada llamada upstream. |
| `MCP_CACHE_TTL_MS` | `300000` | TTL compartido de caché. |
| `MCP_CACHE_MAX_ENTRIES` | `500` | Límite de entradas por proceso. |
| `TMDB_DAILY_REQUEST_LIMIT` | `900` | Presupuesto UTC diario. |

## Ejecutar

Desde la raíz:

```bash
bun install
bun run dev:tmdb-mcp
```

El estado está disponible en `GET http://localhost:3101/health` y el endpoint
MCP en `POST http://localhost:3101/mcp`. Para probarlo manualmente puede
usarse MCP Inspector apuntando a `http://localhost:3101/mcp`.

## Tests

```bash
bun --cwd servers/tmdb-mcp test
```

Los tests inyectan `fetch` y nunca llaman a TMDB ni requieren credenciales.
