# `@agichat/mcp-shared`

Este paquete contiene las políticas reutilizables de caché y presupuesto para
los servicios MCP. No hace llamadas de red y no conoce la implementación de
TMDB ni de Google Books.

## Uso

Cada servidor crea un `McpRequestCache` con el reloj y los límites del entorno:

```ts
const config = readMcpCacheConfig();
const cache = new McpRequestCache(config);

const response = await cache.getOrFetch("tmdb", "search:matrix", () =>
  callTmdb(),
);
```

Los aciertos de caché no incrementan el presupuesto. Las solicitudes
idénticas que llegan simultáneamente comparten una sola promesa. El TTL y el
límite de entradas son configurables, y el contador se separa por proveedor y
se reinicia al cambiar el día UTC. El valor predeterminado es 900 solicitudes
diarias por proveedor, por debajo del máximo de 1000.

Los fallos desconocidos del proveedor se convierten en `UPSTREAM_ERROR` sin
propagar detalles internos. Cuando se alcanza el presupuesto, se devuelve
`RATE_LIMITED` antes de ejecutar la función del proveedor.

`CacheStore` y `BudgetStore` son interfaces independientes de sus
implementaciones en memoria. Se mantiene esta frontera para sustituirlas por
Redis al escalar horizontalmente en el futuro; Redis está fuera del alcance de
este issue.

## Variables

| Variable | Default | Propósito |
| --- | ---: | --- |
| `MCP_CACHE_TTL_MS` | `300000` | Duración de una entrada en milisegundos. |
| `MCP_CACHE_MAX_ENTRIES` | `500` | Máximo de entradas por proceso. |
| `TMDB_DAILY_REQUEST_LIMIT` | `900` | Presupuesto UTC diario de TMDB. |
| `GOOGLE_BOOKS_DAILY_REQUEST_LIMIT` | `900` | Presupuesto UTC diario de Google Books. |

