import { describe, expect, it } from "bun:test";
import { createApp } from "../src/index";
import type { AgentPort } from "../src/agents";

function sendRawAndCollect(ws: WebSocket, raw: string, expectedCount: number): Promise<unknown[]> {
  return new Promise((resolve, reject) => {
    const received: unknown[] = [];
    const timer = setTimeout(() => reject(new Error(`Timeout waiting for ${expectedCount} events, got ${received.length}`)), 3000);
    ws.onmessage = (event) => {
      received.push(JSON.parse(String(event.data)));
      if (received.length >= expectedCount) {
        clearTimeout(timer);
        resolve(received);
      }
    };
    ws.send(raw);
  });
}

describe("WebSocket protocol and validation", () => {
  it("returns INVALID_MESSAGE for messages over 2000 characters and non-JSON frames", async () => {
    const app = createApp({ latency: () => 5 }).listen(0);
    const port = app.server?.port;
    const ws = new WebSocket(`ws://localhost:${port}/ws`);
    await new Promise<void>((res, rej) => { ws.onopen = () => res(); ws.onerror = rej; });

    try {
      const overlongEvents = await sendRawAndCollect(ws, JSON.stringify({
        type: "user_message",
        conversationId: "conv-overlong",
        content: "x".repeat(2001),
        timestamp: new Date().toISOString(),
      }), 1);
      expect(overlongEvents[0]).toMatchObject({
        type: "error",
        conversationId: "conv-overlong",
        error: { code: "INVALID_MESSAGE" },
      });

      const nonJsonEvents = await sendRawAndCollect(ws, "{not-valid-json", 1);
      expect(nonJsonEvents[0]).toMatchObject({
        type: "error",
        conversationId: "unknown",
        error: { code: "INVALID_MESSAGE" },
      });
    } finally {
      ws.close();
      await app.stop(true);
    }
  });

  it("delivers agent_typing -> agent_message -> ui_action in deterministic order", async () => {
    const fakeAgent: AgentPort = {
      async respond(msg) {
        const ts = new Date().toISOString();
        return [
          { type: "agent_typing", conversationId: msg.conversationId, timestamp: ts },
          { type: "agent_message", conversationId: msg.conversationId, content: "Hola", timestamp: ts },
          {
            type: "ui_action",
            conversationId: msg.conversationId,
            action: { kind: "open_url", url: "https://www.imdb.com/title/tt0133093/", source: "imdb" },
            timestamp: ts,
          },
        ];
      },
    };
    const app = createApp({ agent: fakeAgent, latency: () => 25 }).listen(0);
    const port = app.server?.port;
    const ws = new WebSocket(`ws://localhost:${port}/ws`);
    await new Promise<void>((res, rej) => { ws.onopen = () => res(); ws.onerror = rej; });

    try {
      const events = await sendRawAndCollect(ws, JSON.stringify({
        type: "user_message",
        conversationId: "conv-order",
        content: "Hola",
        timestamp: new Date().toISOString(),
      }), 3);
      expect(events.map((e) => (e as { type: string }).type)).toEqual([
        "agent_typing",
        "agent_message",
        "ui_action",
      ]);
    } finally {
      ws.close();
      await app.stop(true);
    }
  });
});
