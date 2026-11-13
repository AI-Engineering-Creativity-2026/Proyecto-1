# Evals de Fase 2

Esta carpeta reservará los casos reproducibles de evaluación del agente. Los
casos se organizarán en:

- funcionales: enrutamiento, herramientas, respuestas y atribución;
- ataques: escenarios de LLM01 (prompt injection) y LLM07 (insecure plugin
  design).

Los evals serán deterministas y usarán mocks de Groq, TMDB, Google Books y MCP.
No se guardarán claves reales ni se harán llamadas externas desde CI.
