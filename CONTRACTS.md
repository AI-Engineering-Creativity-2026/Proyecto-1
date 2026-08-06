# CONTRACTS.md — AGIChat Widget SDK

Este documento define el contrato de comunicación entre las tres capas del proyecto:

```
Mock API (Elysia + TypeBox) <--WS--> Core (Vue composable) <--props/events--> UI (Vue components)
```

El objetivo es que las 3 personas puedan desarrollar en paralelo contra estas interfaces, sin esperar a que las otras capas estén terminadas. **Cualquier cambio a este contrato debe discutirse en grupo antes de mergear**, ya que rompe el trabajo de las otras dos personas.

---

## 1. Contrato Mock API ↔ Core

Este es el contrato más importante, porque en Fase 2 el Mock API se reemplaza por un agente real **sin tocar Core ni UI**. Todo lo que cruza este límite viaja como JSON sobre WebSocket.

### 1.1 Definición en TypeBox (lado servidor — Elysia)

```typescript
// server/src/schemas/chat.schema.ts
import { t } from "elysia";

export const OutgoingMessageSchema = t.Object({
  type: t.Literal("user_message"),
  conversationId: t.String(),
  content: t.String({ minLength: 1 }),
  timestamp: t.String({ format: "date-time" }),
});

export const IncomingMessageSchema = t.Object({
  type: t.Union([
    t.Literal("agent_message"),
    t.Literal("agent_typing"),
    t.Literal("error"),
  ]),
  conversationId: t.String(),
  content: t.Optional(t.String()), // markdown crudo, solo si type === "agent_message"
  error: t.Optional(
    t.Object({
      code: t.String(),
      message: t.String(),
    })
  ),
  timestamp: t.String({ format: "date-time" }),
});

// Tipos inferidos, exportados para consumo del frontend
export type OutgoingMessage = typeof OutgoingMessageSchema.static;
export type IncomingMessage = typeof IncomingMessageSchema.static;
```

### 1.2 Eventos del ciclo de vida de un mensaje

| Evento | Quién lo emite | Cuándo |
|---|---|---|
| `user_message` | Cliente (Core) | Al enviar un mensaje del usuario |
| `agent_typing` | Servidor (Mock API) | Mientras "genera" la respuesta (simula latencia) |
| `agent_message` | Servidor (Mock API) | Respuesta completa del agente, en markdown crudo |
| `error` | Servidor (Mock API) | Si algo falla (timeout simulado, mensaje inválido, etc.) |

### 1.3 Decisiones acordadas

- **Streaming vs mensaje completo:** se define aquí una vez que el equipo lo decida en la sesión de contrato. *(placeholder — actualizar tras la reunión)*
- **Simulación de latencia:** el Mock API debe esperar un delay aleatorio (ej. 500ms–2000ms) antes de responder, y emitir `agent_typing` durante ese lapso, para que UI pueda probar sus estados de carga.
- **Simulación de errores:** el Mock API debe tener un modo/flag para forzar un `error` de forma predecible (ej. si el mensaje contiene la palabra `"__force_error__"`), para que UI y Core puedan testear el estado de error sin depender del azar.

---

## 2. Contrato Core ↔ UI

Lo que el composable de Vue (`useChat`) expone hacia los componentes visuales. La UI **no debe saber nada** sobre WebSockets, JSON crudo, ni reconexiones — solo consume este contrato.

### 2.1 Tipos

```typescript
// core/src/types/chat.ts

export interface Message {
  id: string;
  role: "user" | "agent";
  content: string; // markdown crudo, la UI decide cómo renderizarlo
  timestamp: string; // ISO 8601
  status?: "sending" | "sent" | "error"; // solo relevante para mensajes propios
}

export type ChatStatus =
  | "idle"
  | "connecting"
  | "waiting_response"
  | "error";

export interface ChatState {
  messages: Message[];
  status: ChatStatus;
  error: string | null;
}
```

### 2.2 API del composable

```typescript
// core/src/composables/useChat.ts

export interface UseChatOptions {
  conversationId: string;
  apiUrl: string;
}

export interface UseChatReturn {
  state: Readonly<Ref<ChatState>>;
  sendMessage: (text: string) => void;
  retryLastMessage: () => void;
  clearError: () => void;
}

export function useChat(options: UseChatOptions): UseChatReturn;
```

### 2.3 Reglas de este contrato

- `state` es de solo lectura desde la UI — cualquier mutación pasa por los métodos expuestos (`sendMessage`, `retryLastMessage`).
- Mientras `status === "waiting_response"`, la UI debe deshabilitar el input y mostrar el indicador de "escribiendo".
- Si `status === "error"`, `error` contiene un mensaje legible para mostrar al usuario; `retryLastMessage()` debe reintentar el último mensaje fallido.
- El campo `content` de `Message` **siempre** es markdown crudo, nunca HTML. El sanitizado y render ocurre en la capa de UI, no en Core.

---

## 3. Contrato del SDK público (inicialización)

Cómo un cliente externo de Maxine instala el widget en su sitio.

```typescript
interface AGIChatConfig {
  containerId: string;       // id del elemento HTML donde se monta el widget
  apiUrl: string;            // URL del WebSocket (mock hoy, agente real en fase 2)
  conversationId?: string;   // opcional, se genera uno si no se provee
  theme?: {
    primaryColor?: string;
    fontFamily?: string;
  };
}

declare global {
  interface Window {
    AGIChat: {
      init: (config: AGIChatConfig) => void;
      destroy: () => void;
    };
  }
}
```

Uso esperado por parte de un cliente externo:

```html
<div id="agichat-widget"></div>
<script src="https://cdn.agichat.dev/widget.js"></script>
<script>
  AGIChat.init({
    containerId: "agichat-widget",
    apiUrl: "wss://mock.agichat.dev/ws",
  });
</script>
```

---

## 4. Decisiones cerradas de la sesión de contrato

### 4.1 Streaming vs mensaje completo → **Mensaje completo**

El agente responde con un único evento `agent_message` conteniendo el markdown completo, precedido por `agent_typing` mientras se genera. No se implementa streaming token-por-token en fase 1: simplifica el estado en Core (sin buffers parciales ni markdown incompleto a medio renderizar) y no compromete la fase 2, ya que el contrato WS puede extenderse a streaming después sin romper lo ya construido.

### 4.2 Ownership del historial → **Core lo guarda en memoria; el servidor es stateless**

El Mock API no persiste conversaciones. `Core` mantiene el array `messages` en memoria durante la sesión del widget (Vue `ref`/`reactive`). Al recargar la página se pierde el historial — comportamiento esperado y documentado, no un bug. No hay endpoint de "recuperar historial" en fase 1.

### 4.3 Reconexión ante caída del WebSocket → **Reintento automático con backoff + estado de error explícito**

- Si el socket se cierra inesperadamente, Core intenta reconectar automáticamente hasta 3 veces con backoff (1s → 2s → 4s).
- Si estaba esperando una respuesta (`status === "waiting_response"`) cuando se cae la conexión, ese mensaje del usuario se marca `status: "error"` — no se intenta recuperar una respuesta parcial, porque no existe (ver 4.1).
- Si los 3 reintentos fallan, `state.status` pasa a `"error"` con un mensaje legible en `state.error`.
- El usuario recupera la conversación llamando a `retryLastMessage()`, que reabre el socket y reenvía el último mensaje fallido.

### 4.4 `conversationId` → **Se genera uno nuevo por sesión, no se persiste**

Se genera con `crypto.randomUUID()` al montar el widget (dentro de `AGIChat.init()`), salvo que se provea explícitamente vía `AGIChatConfig.conversationId`. No se guarda en `localStorage`: como el historial tampoco persiste (4.2), persistir solo el id sin datos asociados no aporta valor y evita tener que sincronizar estado "fantasma" entre cliente y servidor.

### 4.5 Nombres de eventos/funciones públicas → **Se mantienen los definidos en las secciones 1–3, sin cambios**

`user_message`, `agent_typing`, `agent_message`, `error`, `useChat`, `sendMessage`, `retryLastMessage`, `clearError`, `AGIChat.init`, `AGIChat.destroy` quedan como el estándar oficial del proyecto. Cualquier renombramiento posterior requiere actualizar este documento vía PR aprobado por las 3 personas.

---

## 5. Ownership de este archivo

Este archivo vive en la raíz del repositorio y su primera versión debe salir de la sesión de acuerdo de contrato entre las 3 personas, **antes** de escribir lógica de negocio. Cambios posteriores requieren aprobación de las 3 personas vía PR, ya que afecta directamente el trabajo de las otras dos capas.