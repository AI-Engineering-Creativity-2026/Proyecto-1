import { describe, expect, it } from "bun:test";
import { effectScope, isRef } from "vue";

import { useChat } from "../src/composables/useChat";
import type { WebSocketLike } from "../src/services/chatSession";

class MockWebSocket implements WebSocketLike {
  readyState = 0;
  readonly sent: string[] = [];
  closed = false;
  private readonly listeners = new Map<string, Set<(event: unknown) => void>>();

  constructor(readonly url: string) {}

  addEventListener(type: "open" | "message" | "close" | "error", listener: (event: unknown) => void): void {
    const bucket = this.listeners.get(type) ?? new Set();
    bucket.add(listener);
    this.listeners.set(type, bucket);
  }

  removeEventListener(type: "open" | "message" | "close" | "error", listener: (event: unknown) => void): void {
    this.listeners.get(type)?.delete(listener);
  }

  send(data: string): void {
    this.sent.push(data);
  }

  close(): void {
    this.readyState = 3;
    this.closed = true;
    for (const listener of this.listeners.get("close") ?? []) {
      listener({ code: 1000, reason: "closed", wasClean: true });
    }
  }

  open(): void {
    this.readyState = 1;
    for (const listener of this.listeners.get("open") ?? []) {
      listener({});
    }
  }
}

describe("useChat", () => {
  it("initializes with reactive state, satisfies UseChatReturn contract and defaults apiUrl", () => {
    const sockets: MockWebSocket[] = [];
    const originalWebSocket = globalThis.WebSocket;

    class TestWebSocket extends MockWebSocket {
      constructor(url: string) {
        super(url);
        sockets.push(this);
      }
    }

    try {
      globalThis.WebSocket = TestWebSocket as unknown as typeof WebSocket;

      const scope = effectScope();
      const chat = scope.run(() =>
        useChat({
          conversationId: "conv-use-chat-1",
        })
      );

      expect(chat).toBeDefined();
      if (!chat) return;

      expect(isRef(chat.state)).toBe(true);
      expect(chat.state.value.status).toBe("connecting");
      expect(chat.state.value.messages).toEqual([]);
      expect(chat.state.value.error).toBeNull();
      expect(typeof chat.sendMessage).toBe("function");
      expect(typeof chat.retryLastMessage).toBe("function");
      expect(typeof chat.clearError).toBe("function");

      // Verify default apiUrl connects to the real server default endpoint
      expect(sockets).toHaveLength(1);
      expect(sockets[0].url).toBe("ws://localhost:3000/ws");

      sockets[0].open();
      expect(chat.state.value.status).toBe("idle");

      chat.sendMessage("Test message from useChat");
      expect(chat.state.value.status).toBe("waiting_response");
      expect(chat.state.value.messages).toHaveLength(1);
      expect(chat.state.value.messages[0].content).toBe("Test message from useChat");

      // Verify disposing effect scope disposes session and closes socket
      scope.stop();
      expect(sockets[0].closed).toBe(true);
    } finally {
      globalThis.WebSocket = originalWebSocket;
    }
  });

  it("uses provided custom apiUrl when given", () => {
    const sockets: MockWebSocket[] = [];
    const originalWebSocket = globalThis.WebSocket;

    class TestWebSocket extends MockWebSocket {
      constructor(url: string) {
        super(url);
        sockets.push(this);
      }
    }

    try {
      globalThis.WebSocket = TestWebSocket as unknown as typeof WebSocket;

      const scope = effectScope();
      const chat = scope.run(() =>
        useChat({
          conversationId: "conv-custom-url",
          apiUrl: "ws://custom-host:8080/chat",
        })
      );

      expect(sockets).toHaveLength(1);
      expect(sockets[0].url).toBe("ws://custom-host:8080/chat");

      scope.stop();
    } finally {
      globalThis.WebSocket = originalWebSocket;
    }
  });
});
