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
        if (name === "discover_movies" || name === "search_movies") {
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
