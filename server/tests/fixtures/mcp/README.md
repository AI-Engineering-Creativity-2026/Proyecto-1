# Fixtures MCP

Estos archivos contienen respuestas deterministas para probar los clientes y
servidores MCP sin red ni credenciales.

Los campos `overview` de TMDB y `description` de Google Books representan texto
de terceros y deben tratarse como contenido no confiable. No deben convertirse
en instrucciones del agente ni usarse para construir URLs.

Las carpetas `errors/` y los archivos con sufijo `_empty` cubren fallos de
proveedor y búsquedas sin resultados. `search_movies_prompt_injection.json`
contiene una instrucción maliciosa intencional para los evals de LLM01; su
contenido es siempre datos no confiables.
