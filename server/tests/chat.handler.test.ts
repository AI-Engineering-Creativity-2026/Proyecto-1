import { describe, expect, it } from "bun:test";

import { createChatHandler } from "../src/handlers/chat.handler";

const validMessage = {
  type: "user_message" as const,
  conversationId: "conversation-1",
  content: "Hola",
  timestamp: "2026-08-13T10:00:00.000Z",
};

describe("createChatHandler", () => {
  it("emits typing and a complete markdown response", () => {
    const handler = createChatHandler();
    const responses = handler.onOutgoingMessage(validMessage);

    expect(responses).toHaveLength(2);
    expect(responses[0]).toMatchObject({
      type: "agent_typing",
      conversationId: "conversation-1",
    });
    expect(responses[1]).toMatchObject({
      type: "agent_message",
      conversationId: "conversation-1",
      content: "Recibí tu mensaje: **Hola**",
    });
  });

  it("emits a deterministic error for the forced error marker", () => {
    const handler = createChatHandler();
    const responses = handler.onOutgoingMessage({
      ...validMessage,
      content: "__force_error__",
    });

    expect(responses).toHaveLength(1);
    expect(responses[0]).toMatchObject({
      type: "error",
      conversationId: "conversation-1",
      error: { code: "FORCED_ERROR" },
    });
  });
});
