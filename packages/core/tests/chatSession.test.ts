import { describe, expect, it } from "bun:test";

import type {
  Scheduler,
  WebSocketLike,
} from "../src/services/chatSession";
import { createChatSession } from "../src/services/chatSession";

type Listener = (event: unknown) => void;

class ManualScheduler implements Scheduler {
  private id = 0;
  private timers: Array<{ id: number; delay: number; callback: () => void }> = [];

  setTimeout(callback: () => void, delay: number): ReturnType<typeof setTimeout> {
    const timer = { id: this.id + 1, delay, callback };
    this.id += 1;
    this.timers.push(timer);
    return timer.id as ReturnType<typeof setTimeout>;
  }

  clearTimeout(handle: ReturnType<typeof setTimeout>): void {
    this.timers = this.timers.filter((timer) => timer.id !== Number(handle));
  }

  get delays(): number[] {
    return this.timers.map((timer) => timer.delay);
  }

  runNext(): void {
    const next = this.timers.shift();

    if (!next) {
      throw new Error("No hay timers pendientes");
    }

    next.callback();
  }
}

class FakeWebSocket implements WebSocketLike {
  readyState = 0;
  readonly sent: string[] = [];
  private readonly listeners = new Map<string, Set<Listener>>();

  constructor(readonly url: string) {}

  addEventListener(type: "open" | "message" | "close" | "error", listener: Listener): void {
    const bucket = this.listeners.get(type) ?? new Set<Listener>();
    bucket.add(listener);
    this.listeners.set(type, bucket);
  }

  removeEventListener(type: "open" | "message" | "close" | "error", listener: Listener): void {
    this.listeners.get(type)?.delete(listener);
  }

  send(data: string): void {
    if (this.readyState !== 1) {
      throw new Error("Socket is not open");
    }

    this.sent.push(data);
  }

  close(): void {
    this.readyState = 3;
    this.dispatch("close", {
      code: 1006,
      reason: "abnormal closure",
      wasClean: false,
    });
  }

  open(): void {
    this.readyState = 1;
    this.dispatch("open", {});
  }

  emitMessage(data: string): void {
    this.dispatch("message", { data });
  }

  private dispatch(type: "open" | "message" | "close" | "error", event: unknown): void {
    for (const listener of this.listeners.get(type) ?? []) {
      listener(event);
    }
  }
}

function createSocketFactory(sockets: FakeWebSocket[]): (url: string) => FakeWebSocket {
  return (url: string) => {
    const socket = new FakeWebSocket(url);
    sockets.push(socket);
    return socket;
  };
}

function createIdFactory(): () => string {
  let count = 0;
  return () => `id-${count += 1}`;
}

describe("createChatSession", () => {
  it("sends user messages and appends incoming agent messages", () => {
    const sockets: FakeWebSocket[] = [];
    const scheduler = new ManualScheduler();
    const session = createChatSession(
      { conversationId: "conv-1", apiUrl: "ws://mock" },
      {
        socketFactory: createSocketFactory(sockets),
        scheduler,
        now: () => "2026-08-13T10:00:00.000Z",
        createId: createIdFactory(),
      }
    );

    expect(sockets).toHaveLength(1);
    sockets[0].open();

    session.sendMessage("Hola **mundo**");

    expect(session.state.value.status).toBe("waiting_response");
    expect(session.state.value.messages).toHaveLength(1);
    expect(session.state.value.messages[0]).toMatchObject({
      role: "user",
      content: "Hola **mundo**",
      status: "sent",
    });

    expect(sockets[0].sent).toHaveLength(1);
    expect(JSON.parse(sockets[0].sent[0])).toMatchObject({
      type: "user_message",
      conversationId: "conv-1",
      content: "Hola **mundo**",
    });

    sockets[0].emitMessage(
      JSON.stringify({
        type: "agent_typing",
        conversationId: "conv-1",
        timestamp: "2026-08-13T10:00:01.000Z",
      })
    );
    expect(session.state.value.status).toBe("waiting_response");

    sockets[0].emitMessage(
      JSON.stringify({
        type: "agent_message",
        conversationId: "conv-1",
        content: "Respuesta con **Markdown**",
        timestamp: "2026-08-13T10:00:02.000Z",
      })
    );

    expect(session.state.value.status).toBe("idle");
    expect(session.state.value.error).toBeNull();
    expect(session.state.value.messages).toHaveLength(2);
    expect(session.state.value.messages[1]).toMatchObject({
      role: "agent",
      content: "Respuesta con **Markdown**",
    });
  });

  it("retries reconnection with backoff before failing definitively", () => {
    const sockets: FakeWebSocket[] = [];
    const scheduler = new ManualScheduler();
    const session = createChatSession(
      { conversationId: "conv-1", apiUrl: "ws://mock" },
      {
        socketFactory: createSocketFactory(sockets),
        scheduler,
        now: () => "2026-08-13T10:00:00.000Z",
        createId: createIdFactory(),
      }
    );

    sockets[0].open();
    session.sendMessage("Hola");
    sockets[0].close();

    expect(session.state.value.messages[0]).toMatchObject({ status: "error" });
    expect(scheduler.delays).toEqual([1000]);

    scheduler.runNext();
    expect(sockets).toHaveLength(2);
    sockets[1].close();
    expect(scheduler.delays).toEqual([2000]);

    scheduler.runNext();
    expect(sockets).toHaveLength(3);
    sockets[2].close();
    expect(scheduler.delays).toEqual([4000]);

    scheduler.runNext();
    expect(sockets).toHaveLength(4);
    sockets[3].close();

    expect(session.state.value.status).toBe("error");
    expect(session.state.value.error).toContain("reconectar");
    expect(scheduler.delays).toEqual([]);
  });

  it("cancels backoff and resends the last failed message on manual retry", () => {
    const sockets: FakeWebSocket[] = [];
    const scheduler = new ManualScheduler();
    const session = createChatSession(
      { conversationId: "conv-1", apiUrl: "ws://mock" },
      {
        socketFactory: createSocketFactory(sockets),
        scheduler,
        now: () => "2026-08-13T10:00:00.000Z",
        createId: createIdFactory(),
      }
    );

    sockets[0].open();
    session.sendMessage("Retry me");
    sockets[0].close();

    expect(scheduler.delays).toEqual([1000]);
    expect(session.state.value.messages[0]).toMatchObject({ status: "error" });

    session.retryLastMessage();

    expect(scheduler.delays).toEqual([]);
    expect(session.state.value.status).toBe("waiting_response");
    expect(session.state.value.error).toBeNull();
    expect(session.state.value.messages[0]).toMatchObject({ status: "sending" });
    expect(sockets).toHaveLength(2);

    sockets[1].open();
    expect(sockets[1].sent).toHaveLength(1);
    expect(JSON.parse(sockets[1].sent[0])).toMatchObject({
      type: "user_message",
      conversationId: "conv-1",
      content: "Retry me",
    });
    expect(session.state.value.messages[0]).toMatchObject({ status: "sent" });
  });
});
