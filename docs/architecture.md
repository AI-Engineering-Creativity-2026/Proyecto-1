# Arquitectura del Sistema AGIChat

Este documento detalla la arquitectura de software del SDK de widget de chat de **AGIChat**, justificando las decisiones de diseño adoptadas y proporcionando una guía integral para que nuevos desarrolladores escalen el proyecto de manera ordenada, predecible y desacoplada.

---

## 1. Diagrama de Alto Nivel (Mermaid.js)

El sistema se organiza en tres componentes principales: Widget, Core del chat y servidor/agente. Los servicios MCP y los proveedores externos forman parte de la implementación interna del servidor y se detallan en las secciones de escalabilidad y arquitectura de agentes.

```mermaid
flowchart LR
    Widget["Widget embebible"] <-->|"Props y eventos"| Core["Core del chat"]
    Core <-->|"WebSocket"| Server["Servidor y agente"]
```

### 1.1 Justificación de Escalabilidad

1. **Separación de responsabilidades**: el Widget presenta la conversación, el Core administra el estado del chat y el servidor coordina el agente. Cada componente puede evolucionar sin trasladar la lógica de las otras capas.
2. **MCP desacoplados**: `tmdb-mcp` y `books-mcp` exponen herramientas por Streamable HTTP y pueden desplegarse por separado del servidor de chat o reutilizarse desde otros agentes.
3. **Estado actual del servidor**: el handler y `ConversationStore` conservan contexto de conversación en memoria con límites de cantidad, tamaño y expiración. El servidor no es completamente *stateless*. Para escalar a varias réplicas sin perder contexto al reconectar, se necesitaría afinidad por conversación o almacenamiento compartido.
4. **Caché, cuota y resiliencia**: la caché TTL y los contadores diarios de `@agichat/mcp-shared` viven en memoria por instancia. Al usar varias réplicas MCP, el presupuesto tendría que compartirse para aplicar un límite global. Los timeouts por capa y el respaldo ante `429` ayudan a controlar fallos de proveedores y respuestas lentas.

---

## 2. Arquitectura de Bajo Nivel de Agentes

El sistema multiagente sigue una **clasificación jerárquica y centralizada**:

- **Centralizada**: Todo mensaje del usuario entra únicamente por `AgentPort` hacia `OrchestratorAgent`, que mantiene el control del flujo, aplica las guardas de seguridad (`prompt-security.ts` contra **LLM01** y **LLM07**) y construye la respuesta final del contrato (`agent-output.ts`).
- **Jerárquica**: `OrchestratorAgent` decide la intención y delega la ejecución especializada a subagentes subordinados (`MovieAgent` y `ComparisonAgent`), sin comunicación lateral *peer-to-peer* entre subagentes ni llamadas directas a APIs REST externas (todo acceso a datos ocurre vía herramientas MCP).

```mermaid
flowchart TD
    In["Mensaje de Usuario (AgentPort)"] --> Guard["Guardas de Seguridad (prompt-security.ts)<br/>Bloqueo LLM01 (Inyección) &amp; LLM07 (Fuga de Prompt)"]
    Guard -->|"Bloqueado"| SafeRefusal["Negativa Segura (sin llamar al LLM)"]
    Guard -->|"Válido"| Orch["OrchestratorAgent (Coordinador Central)"]

    Orch -->|"Intención: recomendar / explorar cine"| Movie["Subagente: MovieAgent"]
    Orch -->|"Intención: comparar película vs. libro"| Comp["Subagente: ComparisonAgent"]
    Orch -->|"429 / Error de herramienta (modo demo)"| Fallback["DemoFallbackAgent (Respaldo MCP Directo)"]

    Movie -->|"search_movies · discover_movies<br/>get_movie_details · get_recommendations"| TMDBMCP["tmdb-mcp"]
    Comp -->|"search_movies · get_movie_details"| TMDBMCP
    Comp -->|"search_books · get_book_details"| BooksMCP["books-mcp"]
    Fallback --> TMDBMCP
    Fallback --> BooksMCP

    Movie --> Output["agent-output.ts<br/>Markdown + poster_url + actions (Allowlist IMDb / Google Books)"]
    Comp --> Output
    Fallback --> Output
```

- **Por qué es jerárquica y centralizada**: Evita ciclos o condiciones de carrera entre subagentes, concentra la política anti-inyección en un único punto antes y después de consultar datos no confiables de terceros, y garantiza que todas las salidas cumplan el esquema `AgentMessageSchema` de `CONTRACTS.md` (incluyendo la allowlist de URLs para pósters y pestañas de IMDb/Google Books).

---

### 2.1 Diagrama de Secuencia del Ciclo de Vida del Mensaje

```mermaid
sequenceDiagram
    autonumber
    actor Usuario
    participant UI as ChatPanel / Composer
    participant Core as useChat / ChatSession
    participant WS as WebSocket Client
    participant Server as Mock API (Elysia)

    Usuario->>UI: Ingresa texto y presiona Enviar
    UI->>Core: sendMessage(texto)
    Core->>Core: Registra mensaje usuario (status: sent) & status = waiting_response
    UI->>UI: Deshabilita composer, muestra TypingIndicator
    Core->>WS: JSON: {"type": "user_message", "content": texto, ...}
    WS->>Server: Envío de payload

    Server->>Server: Valida esquema con TypeBox
    Server->>WS: JSON: {"type": "agent_typing"}
    WS->>Core: Notifica agent_typing (mantiene waiting_response)

    Note over Server: Simula tiempo de procesamiento (750ms)
    
    alt Mensaje Normal
        Server->>WS: JSON: {"type": "agent_message", "content": "Markdown...", ...}
        WS->>Core: Procesa agent_message
        Core->>Core: Agrega mensaje al historial & status = idle
        Core->>UI: Actualiza estado reactivo
        UI->>UI: Convierte Markdown a HTML seguro y renderiza bubble
        UI->>UI: Habilita composer para el usuario
    else Mensaje con __force_error__ o Fallo de Red
        Server->>WS: JSON: {"type": "error", "error": {...}}
        WS->>Core: Procesa error
        Core->>Core: status = error & registra mensaje de error
        Core->>UI: Muestra ErrorCard con botón "Try again"
        Usuario->>UI: Clic en "Try again"
        UI->>Core: retryLastMessage()
        Core->>WS: Reenvía último mensaje fallido
    end
```

---

## 2. Justificación de la Arquitectura Elegida

La arquitectura de AGIChat fue diseñada con los siguientes principios y justificaciones técnicas:

### 2.1 Desacoplamiento Estricto en 3 Capas
1. **Servidor y agente (`server/`)**: Construido con Elysia y TypeBox. Recibe y emite eventos mediante el protocolo WebSocket definido en `CONTRACTS.md`, y coordina el agente configurado. Conserva contexto conversacional acotado en memoria del proceso; por eso no es completamente *stateless*.
   - *Justificación*: Mantener el servidor separado del Core y el Widget permite cambiar entre el agente mock y el agente real sin trasladar lógica de proveedor o de conversación a la interfaz. El estado en memoria es sencillo para una instancia; un despliegue con varias réplicas necesita afinidad de conversación o almacenamiento compartido para conservar el contexto al reconectar.
2. **Core (`packages/core/`)**: Paquete TypeScript puro que exporta el composable `useChat` y el motor `ChatSession`.
   - *Justificación*: Centraliza la máquina de estados del chat, la conexión WebSocket, el manejo de reconexiones con retroceso exponencial (*exponential backoff*), la cola de mensajes mientras conecta y la lógica de reintentos (`retryLastMessage()`). Al ser agnóstico del DOM y de la renderización HTML, puede ser reutilizado en cualquier aplicación web, CLI o móvil en el futuro.
3. **Widget (`widget/`)**: Implementado en Vue 3 y empaquetado como **Web Component** estándar (`defineCustomElement`) junto con la API global `window.AGIChat`.
   - *Justificación*: Permite que cualquier cliente de AGIChat integre el widget en su plataforma mediante una etiqueta `<script>` y un simple `AGIChat.init({ containerId: '...', apiUrl: '...' })`, aislando los estilos mediante Shadow DOM o clases BEM contenidas para evitar colisiones con el CSS del cliente.

### 2.2 Seguridad y Renderizado de Markdown
- El agente emite Markdown crudo. La UI procesa dicho texto mediante `marked` y lo sanea estrictamente con `DOMPurify` antes de inyectarlo en el DOM.
- *Justificación*: Protege a los usuarios y clientes contra inyecciones XSS maliciosas que pudieran provenir de un agente comprometido o de contenido inyectado por terceros.

### 2.3 Resiliencia y Manejo de Errores Determinista
- El servidor mock implementa la bandera `__force_error__` para simular fallos predecibles en pruebas automatizadas y manuales.
- El Core implementa hasta 3 reintentos automáticos ante pérdida de socket y expone estados legibles (`waiting_response`, `error`) con recuperación interactiva.

---

## 3. Estructura de Directorios del Monorepo

El monorepo está organizado utilizando workspaces de Bun:

```text
.
├── .github/
│   └── workflows/
│       ├── ci.yml            # Pipeline CI: lint, typecheck, coverage >=80%, build
│       └── release.yml       # Pipeline CD: publicación automatizada por tags
├── docs/                     # Documentación de arquitectura y diseño
│   ├── images/
│   │   ├── wireframe.png     # Wireframe de referencia UX
│   │   └── widget-preview.png # Captura de la interfaz final implementada
│   └── architecture.md       # Este documento de arquitectura
├── packages/
│   └── core/                 # Lógica de dominio y composable agnóstico
│       ├── src/
│       │   ├── composables/  # useChat.ts (interfaz pública de reactividad)
│       │   ├── services/     # chatSession.ts (transporte WS, colas, backoff)
│       │   ├── types/        # chat.ts (contratos y estados de TypeScript)
│       │   └── index.ts      # Punto de entrada y exportaciones públicas
│       ├── tests/            # Pruebas unitarias de máquina de estado y sesión
│       └── package.json
├── server/                   # Mock API WebSocket en Elysia.js
│   ├── src/
│   │   ├── handlers/         # chat.handler.ts (lógica de simulación y latencia)
│   │   ├── schemas/          # chat.schema.ts (esquemas TypeBox y validaciones)
│   │   └── index.ts          # Servidor Elysia y endpoint WS /ws
│   ├── tests/                # Pruebas del handler y validación de esquemas
│   └── package.json
├── widget/                   # Aplicación Vue 3 y SDK embebible
│   ├── public/               # Recursos estáticos
│   ├── src/
│   │   ├── components/       # Componentes Vue (ChatPanel, Composer, Avatars, etc.)
│   │   ├── styles/           # Estilos modulares del widget (widget.css)
│   │   ├── utils/            # markdown.ts (parser marked + DOMPurify)
│   │   ├── App.vue           # Componente raíz del widget
│   │   ├── index.ts          # Definición de Custom Element y window.AGIChat
│   │   └── main.ts           # Entrada para desarrollo local
│   ├── tests/                # Pruebas unitarias y de integración de UI
│   └── package.json
├── scripts/                  # Scripts de automatización y verificación
│   ├── check-coverage.ts     # Verificador estricto de cobertura (mínimo 80%)
│   └── build-widget.mjs      # Compilación del bundle standalone
├── test/                     # Pruebas end-to-end e integración cruzada
│   ├── helpers/              # Utilidades de prueba
│   └── core-server.test.ts   # Integración real Core <-> Server
├── AGENTS.md                 # Guía para agentes de IA y desarrolladores
├── CONTRACTS.md              # Especificación formal de los contratos de interfaz
├── package.json              # Configuración de workspaces y scripts raíz
├── bun.lock                  # Lockfile de dependencias
└── tsconfig.json             # Configuración base de TypeScript
```

---

## 4. Guía para Nuevos Desarrolladores: Cómo Escalar el Proyecto

Para garantizar que el sistema mantenga su calidad, modularidad y cobertura mínima del 80%, los nuevos desarrolladores deben seguir estos lineamientos al extender el sistema:

### 4.1 Incorporación de Nuevos Eventos en el Protocolo WebSocket
1. **Actualizar el Contrato**: Todo cambio en los mensajes entre servidor y cliente debe discutirse y reflejarse primero en [`CONTRACTS.md`](../CONTRACTS.md).
2. **Definir en TypeBox**: Modificar `server/src/schemas/chat.schema.ts` agregando los nuevos esquemas y tipos exportados.
3. **Manejar en Servidor**: Añadir el caso en `server/src/handlers/chat.handler.ts` y sus pruebas correspondientes en `server/tests/`.
4. **Consumir en Core**: Actualizar `packages/core/src/types/chat.ts` y la gestión de eventos en `packages/core/src/services/chatSession.ts`.

### 4.2 Reemplazo por un Agente Real (Transición a Fase 2)
1. El backend real solo necesita exponer un endpoint WebSocket que cumpla con los esquemas de `server/src/schemas/chat.schema.ts`.
2. Puede reemplazarse el mock API cambiando la URL de conexión en `AGIChat.init({ apiUrl: 'wss://api.agichat.ai/v1/chat' })` sin tocar una sola línea de código en `widget` o `core`.
3. Si el agente requiere streaming de tokens progresivos, se extiende el contrato para soportar eventos de tipo `agent_chunk` manteniendo compatibilidad hacia atrás.

### 4.3 Extensión de la Lógica de Estado (Core)
- La lógica de negocio o estado no debe residir en componentes de Vue (`widget/src/components`).
- Cualquier nueva capacidad (ej. cancelación de mensajes, soporte para adjuntos, persistencia opcional) debe implementarse en `packages/core/src/services/chatSession.ts` y exponerse a través del composable `useChat`.
- Debe acompañarse de pruebas con simulación de temporizadores y sockets en `packages/core/tests/`.

### 4.4 Creación de Nuevos Componentes Visuales (Widget)
- Los componentes deben crearse en `widget/src/components/` siguiendo la filosofía de componentes funcionales y desacoplados.
- Solo deben recibir estado y callbacks mediante `props` y emitir eventos mediante `emits`.
- Todo renderizado de texto generado por el agente debe pasar invariablemente por `renderMarkdown()` de `widget/src/utils/markdown.ts`.

### 4.5 Flujo de Trabajo y Garantía de Calidad
Antes de abrir un Pull Request (siguiendo **GitHub Flow**):
```bash
bun ci                  # Asegurar dependencias sincronizadas
bun run lint            # Verificar estilo y buenas prácticas
bun run typecheck       # Validar tipos en TypeScript estricto
bun run test:coverage   # Comprobar tests y verificar umbral >= 80%
bun run build           # Validar empaquetado exitoso
```
