# ADR: Base de la Fase 2 del agente

## Estado

Aceptada para la preparación del trabajo paralelo. Este documento no
implementa el agente real ni sus servidores MCP.

## Decisiones

### Groq como proveedor LLM

Se usará Groq y el modelo será configurable mediante `GROQ_MODEL`.

Motivo: permite cambiar el modelo sin modificar el código del Orquestador ni
del Widget y mantiene las credenciales fuera del repositorio.

Alternativas descartadas: fijar un modelo en código y acoplar la interfaz a un
proveedor específico distinto de Groq.

### Vercel AI SDK como framework

La implementación futura usará `ai` y `@ai-sdk/groq`, consultando la
documentación vigente antes de integrar sus APIs.

Motivo: ofrece una frontera común para generación y herramientas, adecuada para
el Orquestador y sus subagentes.

Alternativa descartada: implementar llamadas HTTP y manejo de herramientas a
mano dentro del servidor.

### Topología multiagente centralizada

Un Orquestador central enruta cada solicitud a dos subagentes expuestos como
herramientas: Agente de Películas y Agente de Comparación.

Motivo: concentra políticas, límites, seguridad y trazabilidad en un único
punto, sin acoplar el Widget a los subagentes.

Alternativa descartada: una topología distribuida donde el cliente elige
directamente el subagente.

### MCP por servicio y Streamable HTTP

`tmdb-mcp` y `books-mcp` serán servicios separados en Docker Compose, usando
transporte Streamable HTTP y respuestas JSON estructuradas.

Motivo: permite sustituir o escalar cada proveedor independientemente y hace
explícitos los límites de acceso a terceros.

Alternativa descartada: importar SDKs de TMDB o Google Books directamente desde
el Orquestador.

### Mensaje completo y pruebas aisladas

Se mantiene la respuesta completa sin streaming. CI mockea Groq, TMDB y Google
Books; nunca utiliza credenciales ni red de terceros.
