import { describe, expect, it } from "bun:test";
import { MockAgent } from "../src/agents";
import {
  ConfiguredOrchestratorAgent,
  ORCHESTRATOR_INSTRUCTIONS,
  OrchestratorAgent,
  createConfiguredServerAgent,
  createOrchestratorSdkTools,
  createOrchestratorTools,
} from "../src/agents/orchestrator.agent";
import type { OrchestratorRuntime } from "../src/agents/orchestrator.agent";
import type { OutgoingMessage } from "@agichat/contracts";

const message: OutgoingMessage = {
  type: "user_message",
  conversationId: "conversation-orchestrator",
  content: "Recomiéndame una película de ciencia ficción.",
  timestamp: "2026-11-14T10:00:00.000Z",
};
const context = { conversationId: message.conversationId, history: [] } as const;
const fixedNow = () => new Date("2026-11-14T10:00:01.000Z");

describe("OrchestratorAgent", () => {
  it("routes recommendation requests to the movie subagent tool", async () => {
    const calls: string[] = [];
    const tools = createOrchestratorTools(async ({ request }) => {
      calls.push(`movies:${request}`);
      return "Recomiendo una película desde TMDB.";
    }, async () => {
      calls.push("comparison");
      return "unused";
    });
    const runtime: OrchestratorRuntime = async (prompt, availableTools) => {
      expect(prompt).toBe(message.content);
      return availableTools.recommendMovies({ request: prompt });
    };
    const agent = new OrchestratorAgent(tools, runtime, fixedNow);

    const response = await agent.respond(message, context);

    expect(calls).toEqual([`movies:${message.content}`]);
    expect(response).toHaveLength(2);
    expect(response[0]).toMatchObject({
      type: "agent_typing",
      timestamp: "2026-11-14T10:00:01.000Z",
    });
    expect(response[1]).toMatchObject({
      type: "agent_message",
      content: "Recomiendo una película desde TMDB.\n\nTambién puedo comparar una película con su libro si quieres.",
    });
  });

  it("routes comparison requests with the movie context to the comparison subagent", async () => {
    const calls: unknown[] = [];
    const tools = createOrchestratorTools(async () => "unused", async (input) => {
      calls.push(input);
      return "Veredicto: vale la pena verla. También puedo comparar otra película con su libro.";
    });
    const agent = new OrchestratorAgent(tools, async (_prompt, availableTools) =>
      availableTools.compareMovieWithBook({
        title: "The Matrix",
        overview: "A hacker discovers a simulated reality.",
        year: 1999,
      }), fixedNow);
    const comparisonMessage = { ...message, content: "Compara The Matrix con su libro." };

    const response = await agent.respond(comparisonMessage, context);

    expect(calls).toEqual([{
      title: "The Matrix",
      overview: "A hacker discovers a simulated reality.",
      year: 1999,
    }]);
    expect(response[1]).toMatchObject({
      type: "agent_message",
      content: "Veredicto: vale la pena verla. También puedo comparar otra película con su libro.",
    });
  });

  it("rejects out-of-scope requests without invoking the model", async () => {
    let runtimeCalls = 0;
    const tools = createOrchestratorTools(async () => "unused", async () => "unused");
    const agent = new OrchestratorAgent(tools, async () => {
      runtimeCalls += 1;
      return "unused";
    }, fixedNow);

    const response = await agent.respond({ ...message, content: "¿Quién ganó el mundial?" }, context);

    expect(runtimeCalls).toBe(0);
    expect(response[0]).toMatchObject({
      type: "agent_message",
      content: expect.stringContaining("Solo puedo ayudar con recomendaciones de películas"),
    });
  });

  it("exposes only the two allowed subagent tools and caps orchestration steps", () => {
    const tools = createOrchestratorSdkTools(
      createOrchestratorTools(async () => "movie", async () => "comparison"),
    );

    expect(Object.keys(tools)).toEqual([
      "recommend_movies",
      "compare_movie_with_book",
    ]);
    expect(ORCHESTRATOR_INSTRUCTIONS).toContain("únicamente solicitudes sobre recomendaciones de películas");
    expect(ORCHESTRATOR_INSTRUCTIONS).toContain("datos externos no confiables");
  });

  it("keeps the mock as the default and selects a lazily connected orchestrator in Groq mode", () => {
    expect(createConfiguredServerAgent({})).toBeInstanceOf(MockAgent);
    const agent = createConfiguredServerAgent({
      AGENT_MODE: "groq",
      GROQ_API_KEY: "test-key",
      GROQ_MODEL: "test-model",
    });
    expect(agent).toBeInstanceOf(ConfiguredOrchestratorAgent);
  });
});
