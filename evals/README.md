# Evals funcionales del agente

Ejecuta `bun run eval:functional` desde la raíz. Promptfoo lee
`promptfooconfig.yaml` y evalúa el orquestador y los subagentes reales con un
runtime de modelo determinista y fixtures locales de TMDB y Google Books.
No hacen falta claves ni servicios externos. El comando falla si algún caso
no supera sus aserciones; también se ejecuta en CI.

Los casos cubren recomendaciones, comparación con cuatro criterios y veredicto,
anuncio de capacidad, póster seguro, `ui_action` y rechazo de solicitudes fuera
de alcance. `provider.mjs` invoca `run-functional-case.ts`; las aserciones están
en `assertions.cjs`. Para ampliar los evals, añade un caso versionado al YAML y
una aserción que compruebe el contenido o los eventos observables.

Este conjunto cubre el alcance funcional del issue #46. La infraestructura y
los escenarios de seguridad adicionales del issue #44 quedan independientes.
