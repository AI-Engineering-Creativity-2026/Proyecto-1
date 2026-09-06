import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { createApp } from "../server/src/index";
import { createChatSession } from "../packages/core/src/services/chatSession";

function waitFor(predicate: () => boolean, timeoutMs = 4000): Promise<void> {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const interval = setInterval(() => {
      if (predicate()) {
        clearInterval(interval);
        resolve();
      } else if (Date.now() - start > timeoutMs) {
        clearInterval(interval);
        reject(new Error("Timeout waiting for condition"));
      }
    }, 25);
  });
}

describe("Core <-> Server WebSocket Integration", () => {
  let app: ReturnType<typeof createApp>;
  let port: number;
  let apiUrl: string;

  beforeAll(() => {
    app = createApp().listen(0);
    port = app.server?.port ?? 3000;
    apiUrl = `ws://localhost:${port}/ws`;
  });

  afterAll(() => {
    app.stop();
  });

  it("connects to the real Elysia server and transitions from connecting to idle", async () => {
    const session = createChatSession({
      conversationId: "integration-connect",
      apiUrl,
    });

    expect(session.state.value.status).toBe("connecting");

    await waitFor(() => session.state.value.status === "idle");
    expect(session.state.value.status).toBe("idle");
    expect(session.state.value.error).toBeNull();

    session.dispose();
  });

  it("handles the full message lifecycle with latency, typing and raw markdown response", async () => {
    const session = createChatSession({
      conversationId: "integration-messages",
      apiUrl,
    });

    await waitFor(() => session.state.value.status === "idle");

    const messageText = "Necesito ayuda con mi **factura**";
    session.sendMessage(messageText);

    // Immediately transitions to waiting_response and creates user message
    expect(session.state.value.status).toBe("waiting_response");
    expect(session.state.value.messages).toHaveLength(1);
    expect(session.state.value.messages[0]).toMatchObject({
      role: "user",
      content: messageText,
      status: "sent",
    });

    // Server sends agent_typing, state remains waiting_response
    await waitFor(() => session.state.value.messages.length === 2, 2000);

    // After server delay (~750ms), agent_message arrives and state returns to idle
    expect(session.state.value.status).toBe("idle");
    expect(session.state.value.error).toBeNull();
    expect(session.state.value.messages).toHaveLength(2);

    const agentMessage = session.state.value.messages[1];
    expect(agentMessage.role).toBe("agent");
    // Markdown formatting is preserved raw as per contract
    expect(agentMessage.content).toBe(`Recibí tu mensaje: **${messageText}**`);

    session.dispose();
  });

  it("handles deterministic server error via __force_error__ and enables retry", async () => {
    const session = createChatSession({
      conversationId: "integration-error",
      apiUrl,
    });

    await waitFor(() => session.state.value.status === "idle");

    session.sendMessage("Prueba con __force_error__");
    expect(session.state.value.status).toBe("waiting_response");

    // Server immediately replies with error event
    await waitFor(() => session.state.value.status === "error", 2000);

    expect(session.state.value.status).toBe("error");
    expect(session.state.value.error).toBe("No se pudo procesar el mensaje. Intenta de nuevo.");
    expect(session.state.value.messages[0].status).toBe("error");

    // Retry last message resets status and clears error
    session.retryLastMessage();
    expect(session.state.value.status).toBe("waiting_response");
    expect(session.state.value.error).toBeNull();

    // Since message still contains __force_error__, server will return error again
    await waitFor(() => session.state.value.status === "error", 2000);
    expect(session.state.value.status).toBe("error");

    // Clear error resets error to null
    session.clearError();
    expect(session.state.value.error).toBeNull();

    session.dispose();
  });
});
