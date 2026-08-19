import { readonly, ref, type Ref } from "vue";

import type { ChatState, Message } from "../types/chat";

const reconnectDelaysMs = [1000, 2000, 4000] as const;

type SocketEventType = "open" | "message" | "close" | "error";

export interface SocketMessageEvent {
  data: string;
}

export interface SocketCloseEvent {
  code: number;
  reason: string;
  wasClean: boolean;
}

export interface SocketErrorEvent {
  error?: unknown;
}

export interface WebSocketLike {
  readonly readyState: number;
  send(data: string): void;
  close(code?: number, reason?: string): void;
  addEventListener(
    type: SocketEventType,
    listener: (event: SocketMessageEvent | SocketCloseEvent | SocketErrorEvent | Event) => void
  ): void;
  removeEventListener(
    type: SocketEventType,
    listener: (event: SocketMessageEvent | SocketCloseEvent | SocketErrorEvent | Event) => void
  ): void;
}

export interface Scheduler {
  setTimeout: typeof setTimeout;
  clearTimeout: typeof clearTimeout;
}

export interface ChatSessionOptions {
  conversationId: string;
  apiUrl: string;
}

export interface ChatSessionDependencies {
  socketFactory?: (url: string) => WebSocketLike;
  scheduler?: Scheduler;
  now?: () => string;
  createId?: () => string;
}

export interface ChatSession {
  state: Readonly<Ref<ChatState>>;
  sendMessage: (text: string) => void;
  retryLastMessage: () => void;
  clearError: () => void;
  dispose: () => void;
}

interface PendingMessage {
  id: string;
  content: string;
  timestamp: string;
}

interface IncomingMessageShape {
  type: "agent_message" | "agent_typing" | "error";
  conversationId: string;
  content?: string;
  error?: {
    code: string;
    message: string;
  };
  timestamp: string;
}

const initialState = (): ChatState => ({
  messages: [],
  status: "connecting",
  error: null,
});

function createDefaultSocketFactory(url: string): WebSocketLike {
  const WebSocketCtor = globalThis.WebSocket;

  if (typeof WebSocketCtor !== "function") {
    throw new Error("WebSocket is not available in this environment");
  }

  return new WebSocketCtor(url);
}

function createDefaultScheduler(): Scheduler {
  return {
    setTimeout: globalThis.setTimeout.bind(globalThis),
    clearTimeout: globalThis.clearTimeout.bind(globalThis),
  };
}

function createMessageId(createId: () => string): string {
  return `msg_${createId()}`;
}

function cloneMessages(messages: Message[]): Message[] {
  return messages.map((message) => ({ ...message }));
}

function isIncomingMessage(value: unknown): value is IncomingMessageShape {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  if (
    candidate.type !== "agent_message" &&
    candidate.type !== "agent_typing" &&
    candidate.type !== "error"
  ) {
    return false;
  }

  if (typeof candidate.conversationId !== "string") {
    return false;
  }

  if (typeof candidate.timestamp !== "string") {
    return false;
  }

  if (
    candidate.content !== undefined &&
    typeof candidate.content !== "string"
  ) {
    return false;
  }

  if (candidate.error !== undefined) {
    if (
      typeof candidate.error !== "object" ||
      candidate.error === null ||
      typeof (candidate.error as Record<string, unknown>).code !== "string" ||
      typeof (candidate.error as Record<string, unknown>).message !== "string"
    ) {
      return false;
    }
  }

  return true;
}

function createUserMessage(id: string, content: string, timestamp: string): Message {
  return {
    id,
    role: "user",
    content,
    timestamp,
    status: "sending",
  };
}

function createAgentMessage(id: string, content: string, timestamp: string): Message {
  return {
    id,
    role: "agent",
    content,
    timestamp,
  };
}

export function createChatSession(
  options: ChatSessionOptions,
  dependencies: ChatSessionDependencies = {}
): ChatSession {
  const state = ref<ChatState>(initialState());
  const socketFactory = dependencies.socketFactory ?? createDefaultSocketFactory;
  const scheduler = dependencies.scheduler ?? createDefaultScheduler();
  const now = dependencies.now ?? (() => new Date().toISOString());
  const createId = dependencies.createId ?? (() => crypto.randomUUID());

  let socket: WebSocketLike | null = null;
  let disposed = false;
  let reconnectAttempt = 0;
  let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  let pendingMessage: PendingMessage | null = null;
  let retryCandidate: PendingMessage | null = null;

  function patchState(patch: Partial<ChatState>): void {
    state.value = {
      ...state.value,
      ...patch,
      messages: patch.messages ?? cloneMessages(state.value.messages),
    };
  }

  function setStatus(status: ChatState["status"]): void {
    patchState({ status });
  }

  function setError(message: string | null): void {
    patchState({ error: message });
  }

  function clearReconnectTimer(): void {
    if (reconnectTimeout === null) {
      return;
    }

    scheduler.clearTimeout(reconnectTimeout);
    reconnectTimeout = null;
  }

  function closeSocket(): void {
    socket?.removeEventListener("open", handleOpen);
    socket?.removeEventListener("message", handleMessage);
    socket?.removeEventListener("close", handleClose);
    socket?.removeEventListener("error", handleError);
    socket = null;
  }

  function scheduleReconnect(): void {
    if (disposed || reconnectAttempt >= reconnectDelaysMs.length) {
      setStatus("error");
      setError("No se pudo reconectar al chat. Intenta de nuevo.");
      return;
    }

    const delay = reconnectDelaysMs[reconnectAttempt];
    reconnectAttempt += 1;
    setStatus("connecting");

    reconnectTimeout = scheduler.setTimeout(() => {
      reconnectTimeout = null;
      connect();
    }, delay);
  }

  function markPendingAsError(message: string): void {
    if (!pendingMessage) {
      return;
    }

    patchState({
      messages: state.value.messages.map((entry) =>
        entry.id === pendingMessage?.id ? { ...entry, status: "error" } : entry
      ),
      error: message,
      status: "error",
    });

    retryCandidate = pendingMessage;
    pendingMessage = null;
  }

  function flushPendingMessage(): void {
    if (!socket || socket.readyState !== 1 || !pendingMessage) {
      return;
    }

    const outgoing = {
      type: "user_message",
      conversationId: options.conversationId,
      content: pendingMessage.content,
      timestamp: pendingMessage.timestamp,
    };

    socket.send(JSON.stringify(outgoing));

    patchState({
      messages: state.value.messages.map((entry) =>
        entry.id === pendingMessage?.id ? { ...entry, status: "sent" } : entry
      ),
    });
  }

  function connect(): void {
    if (disposed) {
      return;
    }

    if (socket && socket.readyState !== 3) {
      return;
    }

    clearReconnectTimer();
    closeSocket();

    socket = socketFactory(options.apiUrl);
    socket.addEventListener("open", handleOpen);
    socket.addEventListener("message", handleMessage);
    socket.addEventListener("close", handleClose);
    socket.addEventListener("error", handleError);
  }

  function handleOpen(): void {
    reconnectAttempt = 0;

    if (pendingMessage) {
      flushPendingMessage();
      setStatus("waiting_response");
      return;
    }

    setStatus("idle");
    setError(null);
  }

  function handleMessage(event: SocketMessageEvent | SocketCloseEvent | SocketErrorEvent | Event): void {
    if (!("data" in event) || typeof event.data !== "string") {
      return;
    }

    let parsed: unknown;

    try {
      parsed = JSON.parse(event.data);
    } catch {
      return;
    }

    if (!isIncomingMessage(parsed)) {
      return;
    }

    if (parsed.type === "agent_typing") {
      setStatus("waiting_response");
      return;
    }

    if (parsed.type === "error") {
      markPendingAsError(parsed.error?.message ?? "El servidor respondió con un error.");
      retryCandidate = pendingMessage ?? retryCandidate;
      pendingMessage = null;
      return;
    }

    const content = parsed.content ?? "";

    patchState({
      messages: [
        ...state.value.messages,
        createAgentMessage(`msg_${createId()}`, content, parsed.timestamp),
      ],
      status: "idle",
      error: null,
    });

    pendingMessage = null;
    retryCandidate = null;
  }

  function handleClose(): void {
    if (disposed) {
      return;
    }

    if (pendingMessage) {
      markPendingAsError("La conexión se interrumpió. Puedes reintentar el último mensaje.");
    }

    scheduleReconnect();
  }

  function handleError(): void {
    if (disposed) {
      return;
    }

    setError("Se produjo un error de transporte. Reintentando conexión...");
  }

  function sendMessage(text: string): void {
    const content = text.trim();

    if (content.length === 0) {
      setError("El mensaje no puede estar vacío.");
      setStatus("error");
      return;
    }

    const timestamp = now();
    const id = createMessageId(createId);
    const userMessage = createUserMessage(id, text, timestamp);

    patchState({
      messages: [...state.value.messages, userMessage],
      status: "waiting_response",
      error: null,
    });

    pendingMessage = {
      id,
      content: text,
      timestamp,
    };
    retryCandidate = pendingMessage;

    if (!socket || socket.readyState !== 1) {
      connect();
      return;
    }

    flushPendingMessage();
  }

  function retryLastMessage(): void {
    if (!retryCandidate) {
      return;
    }

    clearReconnectTimer();

    const retryMessage = retryCandidate;
    const timestamp = now();

    patchState({
      messages: state.value.messages.map((entry) =>
        entry.id === retryMessage.id ? { ...entry, status: "sending", timestamp } : entry
      ),
      status: "waiting_response",
      error: null,
    });

    pendingMessage = {
      id: retryMessage.id,
      content: retryMessage.content,
      timestamp,
    };

    if (!socket || socket.readyState !== 1) {
      connect();
      return;
    }

    flushPendingMessage();
  }

  function clearError(): void {
    setError(null);

    if (state.value.status === "error") {
      setStatus(socket && socket.readyState === 1 ? "idle" : "connecting");
    }
  }

  function dispose(): void {
    disposed = true;
    clearReconnectTimer();
    closeSocket();
  }

  connect();

  return {
    state: readonly(state),
    sendMessage,
    retryLastMessage,
    clearError,
    dispose,
  };
}
