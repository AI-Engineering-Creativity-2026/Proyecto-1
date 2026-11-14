import { describe, expect, it } from "bun:test";
import type { OutgoingMessage } from "@agichat/contracts";
import { createConfiguredAgent, GroqAgent, MockAgent } from "../src/agents";

const message: OutgoingMessage = {
  type: "user_message",
  conversationId: "conversation-groq",
  content: "Recomiéndame una película de ciencia ficción.",
  timestamp: "2026-08-13T10:00:00.000Z",
};

const context = { conversationId: message.conversationId, history: [] } as const;

describe("GroqAgent", () => {
  it("adapts generated Markdown to the AgentPort message contract", async () => {
    const calls: Array<{ model: string; prompt: string }> = [];
    const agent = new GroqAgent("test-model", async (model, prompt) => {
      calls.push({ model, prompt });
      return "  **Una recomendación**  ";
    });

    const responses = await agent.respond(message, context);

    expect(calls).toEqual([{ model: "test-model", prompt: message.content }]);
    expect(responses).toHaveLength(2);
    expect(responses[0]).toMatchObject({
      type: "agent_typing",
      conversationId: message.conversationId,
    });
    expect(responses[1]).toMatchObject({
      type: "agent_message",
      conversationId: message.conversationId,
      content: "**Una recomendación**",
    });
  });

  it("returns a generic AGENT_ERROR when generation fails", async () => {
    const agent = new GroqAgent("test-model", async () => {
      throw new Error("provider details must not reach the user");
    });

    const responses = await agent.respond(message, context);

    expect(responses).toHaveLength(1);
    expect(responses[0]).toMatchObject({
      type: "error",
      conversationId: message.conversationId,
      error: {
        code: "AGENT_ERROR",
        message: "No se pudo procesar tu mensaje. Intenta de nuevo.",
      },
    });
    expect(JSON.stringify(responses)).not.toContain("provider details");
  });

  it("returns a generic error for an empty model response", async () => {
    const agent = new GroqAgent("test-model", async () => "  ");

    const responses = await agent.respond(message, context);

    expect(responses[0]).toMatchObject({
      type: "error",
      error: { code: "AGENT_ERROR" },
    });
  });
});

describe("createConfiguredAgent", () => {
  it("uses the mock when the mode is omitted or set to mock", () => {
    expect(createConfiguredAgent({})).toBeInstanceOf(MockAgent);
    expect(createConfiguredAgent({ AGENT_MODE: "mock" })).toBeInstanceOf(MockAgent);
  });

  it("requires a supported mode and Groq settings", () => {
    expect(() => createConfiguredAgent({ AGENT_MODE: "unknown" })).toThrow(
      'AGENT_MODE must be either "mock" or "groq".',
    );
    expect(() => createConfiguredAgent({ AGENT_MODE: "groq" })).toThrow(
      "GROQ_API_KEY is required when AGENT_MODE=groq.",
    );
    expect(() =>
      createConfiguredAgent({ AGENT_MODE: "groq", GROQ_API_KEY: "test-key" }),
    ).toThrow("GROQ_MODEL is required when AGENT_MODE=groq.");
  });

  it("selects Groq without making a provider request", () => {
    const agent = createConfiguredAgent({
      AGENT_MODE: "groq",
      GROQ_API_KEY: "test-key",
      GROQ_MODEL: "test-model",
    });

    expect(agent).toBeInstanceOf(GroqAgent);
  });
});
