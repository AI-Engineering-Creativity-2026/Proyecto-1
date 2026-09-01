import { describe, expect, it } from "bun:test";

import { createChatHandler } from "../src/handlers/chat.handler";

describe("createChatHandler", () => {
  it("starts with no generated responses", () => {
    const handler = createChatHandler();

    expect(
      handler.onOutgoingMessage({
        type: "user_message",
        conversationId: "test-conversation",
        content: "Hola",
        timestamp: "2026-08-13T10:00:00.000Z",
      }),
    ).toEqual([]);
  });
});
