import { describe, expect, it } from "bun:test";
import type { OutgoingMessage } from "@agichat/contracts";
import { MockAgent } from "../server/src/agents/mock.agent";
import {
  createChatSession,
  type SocketCloseEvent,
  type SocketErrorEvent,
  type SocketMessageEvent,
  type WebSocketLike,
} from "../packages/core/src/services/chatSession";

type SocketEventType = "open" | "message" | "close" | "error";
type SocketListener = (
  event: SocketMessageEvent | SocketCloseEvent | SocketErrorEvent | Event,
) => void;

class MockServerSocket implements WebSocketLike {
  readyState = 0;
  private readonly listeners = new Map<SocketEventType, Set<SocketListener>>();
  private pendingResponse: Promise<void> = Promise.resolve();

  constructor(private readonly agent: MockAgent) {}

  addEventListener(type: SocketEventType, listener: SocketListener): void {
    const listeners = this.listeners.get(type) ?? new Set<SocketListener>();
    listeners.add(listener);
    this.listeners.set(type, listeners);
  }

  removeEventListener(type: SocketEventType, listener: SocketListener): void {
    this.listeners.get(type)?.delete(listener);
  }

  send(data: string): void {
    const message = JSON.parse(data) as OutgoingMessage;
    this.pendingResponse = this.pendingResponse.then(async () => {
      const responses = await this.agent.respond(message, {
        conversationId: message.conversationId,
        history: [],
      });

      for (const response of responses) {
        this.dispatch("message", { data: JSON.stringify(response) });
      }
    });
  }

  close(): void {
    this.readyState = 3;
    this.dispatch("close", { code: 1000, reason: "closed", wasClean: true });
  }

  open(): void {
    this.readyState = 1;
    this.dispatch("open", {});
  }

  flush(): Promise<void> {
    return this.pendingResponse;
  }

  private dispatch(type: SocketEventType, event: unknown): void {
    for (const listener of this.listeners.get(type) ?? []) {
      listener(event as SocketMessageEvent | SocketCloseEvent | SocketErrorEvent | Event);
    }
  }
}

function createSession(agent = new MockAgent()) {
  const socket = new MockServerSocket(agent);
  const session = createChatSession(
    { conversationId: "demo-conversation", apiUrl: "ws://mock-server/ws" },
    {
      socketFactory: () => socket,
      now: () => "2026-11-15T10:00:00.000Z",
      createId: () => "test-id",
    },
  );

  return { session, socket };
}

describe("Core <-> server message contract", () => {
  it("transitions from connecting to idle when the socket opens", () => {
    const { session, socket } = createSession();

    expect(session.state.value.status).toBe("connecting");
    socket.open();

    expect(session.state.value.status).toBe("idle");
    expect(session.state.value.error).toBeNull();
    session.dispose();
  });

  it("handles typing and a complete raw Markdown response without real sockets or delays", async () => {
    const { session, socket } = createSession();
    socket.open();
    session.sendMessage("Necesito ayuda con mi **factura**");

    expect(session.state.value.status).toBe("waiting_response");
    expect(session.state.value.messages[0]).toMatchObject({
      role: "user",
      content: "Necesito ayuda con mi **factura**",
      status: "sent",
    });

    await socket.flush();

    expect(session.state.value.status).toBe("idle");
    expect(session.state.value.error).toBeNull();
    expect(session.state.value.messages[1]).toMatchObject({
      role: "agent",
      content: "Recibí tu mensaje: **Necesito ayuda con mi **factura****",
    });
    session.dispose();
  });

  it("handles deterministic errors and retries through the same contract", async () => {
    const { session, socket } = createSession();
    socket.open();
    session.sendMessage("Prueba con __force_error__");
    await socket.flush();

    expect(session.state.value.status).toBe("error");
    expect(session.state.value.error).toBe("No se pudo procesar el mensaje. Intenta de nuevo.");
    expect(session.state.value.messages[0]?.status).toBe("error");

    session.retryLastMessage();
    expect(session.state.value.status).toBe("waiting_response");
    await socket.flush();
    expect(session.state.value.status).toBe("error");

    session.clearError();
    expect(session.state.value.error).toBeNull();
    session.dispose();
  });
});
