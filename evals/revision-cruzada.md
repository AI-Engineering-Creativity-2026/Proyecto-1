# Registro de revisión cruzada de evaluaciones

Fecha de corte: 16 de noviembre de 2026.

Este registro verifica que cada conjunto de evaluaciones tenga una aprobación
de GitHub hecha por una persona distinta de quien lo implementó. La evidencia
fuente son las revisiones aprobadas de los PR indicados.

## Registro

| Conjunto | Alcance revisado | Autoría registrada | Persona revisora | Evidencia | Estado |
| --- | --- | --- | --- | --- | --- |
| Funcional Promptfoo | \`evals/promptfooconfig.yaml\`, \`evals/assertions.cjs\` y el adaptador de Promptfoo | jdivass | Luis-Angel-G | PR #74, revisión \`APPROVED\` | Validado |
| Funcional versionado | Casos funcionales de \`evals/cases.json\` y runner fake | Luis-Angel-G | MarceloDetlefsen | PR #76, revisión \`APPROVED\` | Validado |
| LLM01 indirecto | Fixtures de TMDB y Google Books y sus casos deterministas | MarceloDetlefsen | jdivass | PR #75, revisión \`APPROVED\` | Validado |
| LLM01 consolidado | Inyección directa, indirecta y navegación en el runner versionado | Luis-Angel-G | MarceloDetlefsen | PR #76, revisión \`APPROVED\` | Validado |
| LLM07 | Extracción del prompt y variantes de ingeniería social en \`evals/cases.json\` | Luis-Angel-G | MarceloDetlefsen | PR #76, revisión \`APPROVED\` | Validado |

La revisión del conjunto LLM01 indirecto queda registrada por separado porque
sus fixtures iniciales fueron aportadas en el PR #75 por Marcelo y luego el
runner consolidado de ataques se incorporó en el PR #76 por Luis-Angel-G.
Así, ninguna de las dos partes depende de una aprobación del propio autor.

## Resoluciones de casos ambiguos

- Las suites funcionales de Promptfoo y del runner versionado se mantienen
  ambas: Promptfoo cubre la integración funcional detallada y \`evals/cases.json\`
  es la colección versionada que consume \`bun run eval:run\`.
- Los casos indirectos LLM01 usan fixtures sintéticas y se ejecutan en modo
  \`fake\`. En modo real se omiten deliberadamente porque el agente real no debe
  recibir fixtures inyectadas; esta decisión está documentada en \`evals/README.md\`.
- Una descripción de Google Books con instrucciones incrustadas sigue siendo
  contenido no confiable. El resultado esperado es conservar el veredicto
  basado en evidencia y no revelar instrucciones internas, no eliminar el
  texto de la fixture.
- Una solicitud de navegación hacia un host no permitido se clasifica como
  ataque LLM01 de navegación y no como caso funcional de \`open_url\`; debe
  terminar sin \`ui_action\`.

No quedan casos ambiguos sin resolución documentada en los conjuntos revisados.

## Cómo reproducir la revisión técnica

\`\`\`bash
bun run eval:run -- --mode fake
bun run eval:functional
\`\`\`

El modo fake no llama a Groq, TMDB ni Google Books. Las aprobaciones humanas se
verifican en los PR enlazados de este registro.
