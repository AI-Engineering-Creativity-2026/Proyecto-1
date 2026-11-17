import { describe, expect, it } from "bun:test";
import type { OutgoingMessage } from "@agichat/contracts";
import { DemoFallbackAgent } from "../src/agents/demo-fallback.agent";
import { createMcpClients } from "../src/mcp/mcp.clients";

const FIXED_NOW = () => new Date("2026-11-17T12:00:00.000Z");

function userMsg(content: string): OutgoingMessage {
  return {
    type: "user_message",
    conversationId: "demo-conv",
    content,
    timestamp: FIXED_NOW().toISOString(),
  };
}

async function readFixture(path: string): Promise<unknown> {
  return Bun.file(new URL(`./fixtures/mcp/${path}`, import.meta.url)).json();
}

async function makeClients() {
  const tmdbSearch = await readFixture("tmdb/search_movies.json");
  const booksSearch = await readFixture("books/search_books.json");

  return createMcpClients({
    tmdb: {
      async callTool(name) {
        if (name === "discover_movies" || name === "search_movies" || name === "get_recommendations") {
          return { structuredContent: tmdbSearch };
        }
        throw new Error(`Unexpected TMDB tool ${name}`);
      },
    },
    books: {
      async callTool(name) {
        if (name === "search_books") {
          return { structuredContent: booksSearch };
        }
        throw new Error(`Unexpected Books tool ${name}`);
      },
    },
  });
}

describe("DemoFallbackAgent", () => {
  it("falls back to live MCP comparison when Groq throws 429", async () => {
    const agent = new DemoFallbackAgent(
      {
        async respond() {
          throw new Error("429 rate_limit_exceeded");
        },
      },
      () => makeClients(),
      FIXED_NOW,
    );

    const events = await agent.respond(userMsg("¿Es fiel Fight Club al libro de Chuck Palahniuk?"), {
      conversationId: "demo-conv",
      history: [],
    });

    const msg = events.find((e) => e.type === "agent_message");
    expect(msg).toBeDefined();
    if (msg?.type === "agent_message") {
      expect(msg.content).toContain("Veredicto:");
      expect(msg.providers).toContain("tmdb");
      expect(msg.providers).toContain("google_books");
    }
    expect(events.some((e) => e.type === "ui_action")).toBe(true);
  });

  it("falls back to live MCP genre discovery when Groq throws 429", async () => {
    const agent = new DemoFallbackAgent(
      {
        async respond() {
          throw new Error("AGENT_RATE_LIMIT");
        },
      },
      () => makeClients(),
      FIXED_NOW,
    );

    const events = await agent.respond(userMsg("Recomiéndame ciencia ficción"), {
      conversationId: "demo-conv",
      history: [],
    });

    const msg = events.find((e) => e.type === "agent_message");
    expect(msg).toBeDefined();
    if (msg?.type === "agent_message") {
      expect(msg.content).toContain("ciencia ficción");
      expect(msg.providers).toContain("tmdb");
    }
  });

  it("falls back when primary returns a RATE_LIMITED or AGENT_RATE_LIMIT error event", async () => {
    const agent = new DemoFallbackAgent(
      {
        async respond() {
          return [
            {
              type: "error",
              conversationId: "demo-conv",
              error: {
                code: "RATE_LIMITED",
                message: "Un servicio alcanzó su límite de solicitudes. Intenta más tarde.",
              },
              timestamp: FIXED_NOW().toISOString(),
            },
          ];
        },
      },
      () => makeClients(),
      FIXED_NOW,
    );

    const events = await agent.respond(userMsg("Recomiéndame un thriller psicológico"), {
      conversationId: "demo-conv",
      history: [],
    });

    const msg = events.find((e) => e.type === "agent_message");
    expect(msg).toBeDefined();
    if (msg?.type === "agent_message") {
      expect(msg.content).toContain("suspenso");
      expect(msg.providers).toContain("tmdb");
    }
  });

  it("handles favorite-movie similarity and stop-motion genre prompts", async () => {
    const agent = new DemoFallbackAgent(
      {
        async respond() {
          throw new Error("RATE_LIMITED");
        },
      },
      () => makeClients(),
      FIXED_NOW,
    );

    const favEvents = await agent.respond(userMsg("Si Coraline es mi pelicula favorita, cual otra me recomiendas?"), {
      conversationId: "demo-conv",
      history: [],
    });
    const favMsg = favEvents.find((e) => e.type === "agent_message");
    expect(favMsg).toBeDefined();
    if (favMsg?.type === "agent_message") {
      expect(favMsg.content).toContain("Si te gustó");
    }

    const stopMotionEvents = await agent.respond(
      userMsg("Que otras peliculas aparte de Wildwood me recomiendas de stop motion"),
      { conversationId: "demo-conv", history: [] },
    );
    const smMsg = stopMotionEvents.find((e) => e.type === "agent_message");
    expect(smMsg).toBeDefined();
    if (smMsg?.type === "agent_message") {
      expect(smMsg.providers).toContain("tmdb");
    }
  });

  it("rethrows non-rate-limit errors without falling back", async () => {
    const agent = new DemoFallbackAgent(
      {
        async respond() {
          throw new Error("Unexpected auth failure");
        },
      },
      () => makeClients(),
      FIXED_NOW,
    );

    await expect(
      agent.respond(userMsg("Recomiéndame ciencia ficción"), {
        conversationId: "demo-conv",
        history: [],
      }),
    ).rejects.toThrow("Unexpected auth failure");
  });
});
