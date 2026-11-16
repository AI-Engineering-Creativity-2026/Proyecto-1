import { describe, expect, it } from "bun:test";
import { createWebSocketEvalAdapter, type EvalWebSocket } from "./eval-adapters";
import type { EvalCase } from "./evaluation-runner";

class FakeWebSocket extends EventTarget implements EvalWebSocket {
  readonly sent: string[] = [];
  wasClosed = false;
  failSend = false;

  send(data: string): void {
    if (this.failSend) throw new Error("Transport details");
    this.sent.push(data);
  }

  close(): void {
    this.wasClosed = true;
    this.dispatchEvent(new Event("close"));
  }

  open(): void {
    this.dispatchEvent(new Event("open"));
  }

  receive(value: unknown): void {
    this.dispatchEvent(new MessageEvent("message", { data: JSON.stringify(value) }));
  }
}

describe("WebSocket eval adapter", () => {
  it("sends the prompt and collects contract-valid events until the final answer", async () => {
    const socket = new FakeWebSocket();
    const adapter = createWebSocketEvalAdapter("ws://test.local/ws", 1000, () => socket);
    const pending = adapter.run(createCase("Recommend a movie"));

    socket.open();
    const sent: unknown = JSON.parse(socket.sent[0] ?? "null");
    expect(sent).toMatchObject({ type: "user_message", content: "Recommend a movie" });
    const conversationId = readConversationId(sent);
    socket.receive({
      type: "agent_typing",
      conversationId,
      timestamp: "2026-11-16T10:00:00.000Z",
    });
    socket.receive({
      type: "agent_message",
      conversationId,
      content: "The Matrix",
      timestamp: "2026-11-16T10:00:01.000Z",
    });

    await expect(pending).resolves.toMatchObject({
      messages: [{ type: "agent_typing" }, { type: "agent_message", content: "The Matrix" }],
    });
    expect(socket.wasClosed).toBe(true);
  });

  it("rejects malformed server events instead of accepting them into an evaluation", async () => {
    const socket = new FakeWebSocket();
    const adapter = createWebSocketEvalAdapter("ws://test.local/ws", 1000, () => socket);
    const pending = adapter.run(createCase("Recommend a movie"));
    socket.open();
    socket.receive({ type: "agent_message", conversationId: "wrong-payload" });

    await expect(pending).rejects.toThrow("no cumplen el contrato");
    expect(socket.wasClosed).toBe(true);
  });

  it("returns a safe failure when the socket refuses to send a test case", async () => {
    const socket = new FakeWebSocket();
    socket.failSend = true;
    const adapter = createWebSocketEvalAdapter("ws://test.local/ws", 1000, () => socket);
    const pending = adapter.run(createCase("Recommend a movie"));
    socket.open();

    await expect(pending).rejects.toThrow("No se pudo enviar el caso");
    expect(socket.wasClosed).toBe(true);
  });
});

function readConversationId(value: unknown): string {
  if (typeof value === "object" && value !== null && "conversationId" in value &&
    typeof value.conversationId === "string") {
    return value.conversationId;
  }
  throw new Error("The adapter did not send a conversation ID.");
}

function createCase(prompt: string): EvalCase {
  return {
    id: "adapter-test",
    description: "WebSocket adapter test",
    prompt,
    assertions: {},
  };
}
