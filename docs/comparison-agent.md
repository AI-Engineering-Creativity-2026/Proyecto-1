# Subagente de comparación película-libro

El `ComparisonAgent` recibe los datos de una película del orquestador y busca
libros por su título usando exclusivamente el cliente Google Books MCP. Si la
búsqueda no devuelve resultados, responde que no encontró un libro asociado y
no invoca el modelo. Si encuentra uno, obtiene sus detalles por `volumeId` y
genera una comparación con esos datos.

La búsqueda por título no demuestra que el libro sea la fuente de la película.
El agente debe aclarar esa limitación cuando no exista evidencia explícita y no
presentar coincidencias de título como adaptaciones confirmadas. El modelo solo
puede usar los campos recibidos de la película y del libro; debe marcar como
insuficiente cualquier criterio que esos campos no permitan evaluar, sin añadir
datos de su conocimiento previo.

## Criterios de comparación

El prompt del subagente requiere evaluar:

1. Coincidencia de la premisa y los acontecimientos centrales, solo cuando las
   descripciones aporten evidencia.
2. Personajes, motivaciones, evolución y relaciones que puedan compararse con
   la información disponible.
3. Temas y mensaje, incluyendo qué conserva, cambia o enfatiza la película.
4. Adaptación al cine, como ritmo o recursos visuales, únicamente cuando hay
   evidencia suficiente para evaluarlos.

La respuesta termina con un veredicto explícito (`Vale la pena verla` o `No
vale la pena verla`) y no inventa hechos ausentes de las fuentes.
