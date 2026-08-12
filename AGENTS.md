## Vistazo general

- El producto es un *widget* embebible de chat para clientes de AGIChat.
- El flujo visual debe respetar el [wireframe de Penpot](https://design.penpot.app/#/view?file-id=3be9e5e1-190f-8090-8008-6e79481381ed&page-id=3be9e5e1-190f-8090-8008-6e79481381ee&section=interactions&index=0&share-id=81f57451-85cc-819d-8008-6e8de838718a). La paleta y el estilo son libres, pero no se deben cambiar los flujos o estados de UX sin acuerdo del equipo.
- [`CONTRACTS.md`](./CONTRACTS.md) es la fuente de verdad para los mensajes WebSocket, el composable `useChat` y la API pública `window.AGIChat`. Léelo antes de modificar esas fronteras.
- Si una instrucción conflictúa con `CONTRACTS.md`, detén el cambio y propón una actualización explícita del contrato; no adaptes silenciosamente una capa a otra.

## Arquitectura y límites

La solución tiene tres capas desacopladas:

```text
Mock API (Elysia + TypeBox) <─ WebSocket JSON ─> Core (Vue composable) <─ props/events ─> UI (componentes Vue)
```

- **Mock API:** valida y emite los eventos del contrato. Es intercambiable por el agente real; no debe contener lógica de presentación ni guardar historial.
- **Core:** centraliza socket, reconexión, estado y reintentos. Mantiene el historial solamente en memoria. No renderiza HTML/Markdown ni accede al DOM.
- **UI:** recibe datos y acciones del Core mediante props/eventos. No abre WebSockets ni conoce su protocolo. Es responsable de transformar el Markdown del agente a HTML seguro.
- **SDK:** expone únicamente la inicialización y destrucción documentadas en `CONTRACTS.md`; configura el montaje del widget y genera `conversationId` si falta.

No importes componentes de UI desde Core ni dependencias del servidor en el cliente. Mantén los tipos compartidos en un lugar neutral y evita duplicar literales de eventos o estados.

## Estructura objetivo

Al crear archivos, usa esta organización salvo que una decisión documentada justifique otra:

```text
server/
  src/
    schemas/        # TypeBox y tipos del protocolo WebSocket
    handlers/       # comportamiento del Mock API
  tests/
core/
  src/
    composables/    # useChat y conexión WebSocket
    types/          # estado y tipos del dominio
    services/       # adaptadores de transporte, si son necesarios
  tests/
ui/
  src/
    components/     # vista del widget y componentes pequeños
    composables/    # comportamiento estrictamente visual
    styles/
  tests/
sdk/
  src/              # montaje y API pública window.AGIChat
  tests/
docs/               # arquitectura, contribución y decisiones de diseño
.github/workflows/  # CI/CD de GitHub Actions
```

No crees directorios vacíos. Agrega una carpeta cuando tenga una responsabilidad concreta y al menos un archivo.

## Comandos para testear y buildear

Cuando existan `package.json` y `bun.lock` en la raíz, estos son los scripts obligatorios y los comandos que se deben ejecutar antes de abrir un PR:

```bash
bun ci
bun run lint
bun run typecheck
bun run test:coverage
bun run build
```

`bun ci` exige que `package.json` y `bun.lock` estén sincronizados. `test:coverage` debe ejecutar la suite y fallar si no se alcanza el umbral configurado. La CI usa estos mismos comandos: no sustituyas un script por una instrucción manual ni lo elimines sin actualizar el workflow y esta guía.

## Guías de estilo de código

- Usa TypeScript estricto; evita `any`, *casts* inseguros y estado implícito.
- Prefiere funciones pequeñas, nombres descriptivos y retornos tipados en las interfaces públicas.
- Valida todos los datos que lleguen por WebSocket antes de usarlos. Los eventos válidos son `user_message`, `agent_typing`, `agent_message` y `error`.
- Conserva el contenido de los mensajes como Markdown crudo hasta la UI. Antes de insertarlo en el DOM, conviértelo con una librería de Markdown y sanitízalo; nunca uses `v-html` con contenido no sanitizado.
- El input debe respetar los estados del contrato: durante `waiting_response` se deshabilita y se muestra que el agente está escribiendo; los errores deben ser legibles y recuperables con `retryLastMessage()`.
- Implementa la latencia y el error determinista (`__force_error__`) en el mock para permitir pruebas repetibles.
- No añadas persistencia de historial o `localStorage` en fase 1 sin una decisión documentada.

## Instrucciones para testear

- Toda lógica nueva o modificada debe llevar pruebas. Prioriza el contrato WebSocket, las transiciones de `useChat`, reconexión/backoff, reintento, sanitización/render de Markdown y estados visibles de UI.
- Mantén como mínimo 80% de cobertura global (líneas, funciones, ramas y sentencias cuando la herramienta lo permita). No reduzcas el umbral para hacer pasar CI.
- Las pruebas no deben depender de temporizadores reales, red externa ni orden global. Simula WebSockets, reloj y respuestas del Mock API.
- Ejecuta los comandos de lint, comprobación de tipos, pruebas y cobertura definidos en `package.json` antes de abrir un PR. Si aún no existen, incorpora scripts reproducibles en vez de documentar comandos manuales.
- La CI de GitHub Actions debe ejecutar instalación reproducible, lint, typecheck, tests y cobertura en cada PR y en `main`. Mantén el *build*/empaquetado separado o como requisito previo del despliegue.

## Flujo de colaboración

- Se usa **GitHub Flow**: parte de `main`, crea una rama corta con nombre claro (`feat/...`, `fix/...`, `docs/...`, `chore/...`), abre PR y haz merge solo tras revisión grupal y CI verde.
- No hagas *push* directo a `main`, no fuerces *push* sobre trabajo ajeno y no mezcles refactors amplios con un cambio funcional sin explicarlo.
- Describe en cada PR: propósito, capas afectadas, pruebas ejecutadas, cambios de contrato (si existen) y evidencia visual cuando cambie la UI.
- Cualquier cambio a `CONTRACTS.md` requiere discusión y aprobación del equipo completo, porque afecta el trabajo paralelo.

## Forma de trabajar de los agentes

1. Inspecciona primero los archivos, scripts y cambios locales existentes; preserva cambios ajenos.
2. Define el alcance mínimo y ubica el cambio en una sola capa cuando sea posible.
3. Antes de implementar, confirma que no rompe el contrato ni mezcla responsabilidades entre capas.
4. Implementa junto con sus pruebas y actualiza documentación cuando cambie una interfaz, estructura o decisión arquitectónica.
5. Ejecuta las verificaciones disponibles y reporta exactamente qué se ejecutó y qué no pudo verificarse.

## Estándares de seguridad

- No incluyas secretos, tokens, URLs privadas ni llaves de agentes en el repositorio. Usa variables de entorno documentadas mediante un archivo de ejemplo sin valores reales.
- Valida los mensajes entrantes del WebSocket antes de usarlos y nunca renderices Markdown no sanitizado.
- No expongas detalles internos, trazas de error ni datos de conversaciones al usuario final.
