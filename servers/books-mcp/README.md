# books-mcp

Servidor MCP de libros para AGIChat. Usa Streamable HTTP con el SDK oficial
`@modelcontextprotocol/sdk`.

## Herramientas

- `search_books({ title, author? })`
- `get_book_details({ volumeId })`

La URL de cada libro se construye en las capas consumidoras a partir de
`volumeId`; este servidor no usa el `infoLink` de Google Books. La descripción
es texto de terceros no confiable y se limita a 4000 caracteres. Cuando faltan
autores o descripción se devuelven `[]` y `""`, respectivamente; no se
inventan datos. Un volumen sin identificador o título válido se descarta en
búsquedas y produce `UPSTREAM_ERROR` en detalles.

## Variables

| Variable | Default | Descripción |
| --- | --- | --- |
| `BOOKS_MCP_PORT` | `3102` | Puerto HTTP del servicio. |
| `GOOGLE_BOOKS_API_KEY` | vacío | Opcional; sin ella se usa cuota anónima. |
| `GOOGLE_BOOKS_UPSTREAM_TIMEOUT_MS` | `10000` | Timeout upstream. |
| `MCP_CACHE_TTL_MS` | `300000` | TTL compartido de caché. |
| `MCP_CACHE_MAX_ENTRIES` | `500` | Límite de entradas por proceso. |
| `GOOGLE_BOOKS_DAILY_REQUEST_LIMIT` | `900` | Presupuesto UTC diario. |

## Ejecutar y probar

```bash
bun install
bun run dev:books-mcp
bun --cwd servers/books-mcp test
```

El servicio expone `GET http://localhost:3102/health` y `POST
http://localhost:3102/mcp`. Puede apuntarse MCP Inspector al endpoint MCP.
Los tests inyectan HTTP mockeado, bloquean la red y no requieren una API key.
