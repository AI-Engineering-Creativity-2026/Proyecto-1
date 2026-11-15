import { describe, expect, it } from "bun:test";
import {
  COMPARISON_INSTRUCTIONS,
  COMPARISON_CRITERIA,
  ComparisonAgent,
  ComparisonAgentError,
  createComparisonAgentTools,
  createConfiguredComparisonAgent,
  type ComparisonRuntime,
  type MovieForComparison,
} from "../src/agents/comparison.agent";
import {
  createMcpClients,
  type BooksMcpClient,
  type McpToolInvoker,
} from "../src/mcp/mcp.clients";

const movie: MovieForComparison = {
  title: "The Matrix",
  overview: "A computer hacker learns about the true nature of reality.",
  year: 1999,
  genres: ["Action", "Science Fiction"],
};

async function readFixture(path: string): Promise<unknown> {
  return Bun.file(new URL(`./fixtures/mcp/${path}`, import.meta.url)).json();
}

function createBooksInvoker(
  searchFixture: string,
  detailsFixture = "books/get_book_details.json",
): McpToolInvoker {
  return {
    async callTool(name) {
      const fixturePath = name === "search_books"
        ? searchFixture
        : name === "get_book_details"
          ? detailsFixture
          : undefined;
      if (!fixturePath) throw new Error("Unknown books fixture tool");
      return { structuredContent: await readFixture(fixturePath) };
    },
  };
}

function createClients(searchFixture: string) {
  return createMcpClients({
    tmdb: { callTool: async () => ({ structuredContent: { results: [] } }) },
    books: createBooksInvoker(searchFixture),
  });
}

const mockRuntime: ComparisonRuntime = async (_movie, book) =>
  `Criterios considerados: fidelidad, personajes, temas y adaptación. Libro: ${book.title}. Veredicto: Vale la pena verla.`;

describe("comparison subagent", () => {
  it("uses Google Books MCP and returns an explicit verdict based on fixture data", async () => {
    const clients = createClients("books/search_books.json");
    const calls: string[] = [];
    const books: BooksMcpClient = {
      async searchBooks(input) {
        calls.push(`search:${input.title}`);
        return clients.books.searchBooks(input);
      },
      async getBookDetails(input) {
        calls.push(`details:${input.volumeId}`);
        return clients.books.getBookDetails(input);
      },
    };
    const agent = new ComparisonAgent(books, async (movieData, bookData) => {
      expect(movieData.title).toBe("The Matrix");
      expect(bookData.title).toBe("The Matrix and Philosophy");
      return mockRuntime(movieData, bookData);
    });

    await expect(agent.run(movie)).resolves.toContain("Veredicto: Vale la pena verla.");
    expect(calls).toEqual([
      "search:The Matrix",
      "details:zyTCAlFPjgYC",
    ]);
    await clients.close();
  });

  it("reports no book deterministically and skips the model", async () => {
    const clients = createClients("books/search_books_empty.json");
    let runtimeCalls = 0;
    const agent = new ComparisonAgent(clients.books, async () => {
      runtimeCalls += 1;
      return "No debe ejecutarse";
    });

    await expect(agent.run(movie)).resolves.toContain("No encontré un libro asociado");
    expect(runtimeCalls).toBe(0);
    await clients.close();
  });

  it("rejects invalid movie inputs without searching", async () => {
    let searchCalls = 0;
    const agent = new ComparisonAgent({
      searchBooks: async () => {
        searchCalls += 1;
        return { results: [] };
      },
      getBookDetails: async () => { throw new Error("unused"); },
    }, async () => "unused");

    await expect(agent.run({ ...movie, title: " " })).rejects.toMatchObject({
      code: "INVALID_MESSAGE",
    });
    expect(searchCalls).toBe(0);
  });

  it("hides provider details when MCP or model execution fails", async () => {
    const agent = new ComparisonAgent({
      searchBooks: async () => { throw new Error("provider secret"); },
      getBookDetails: async () => { throw new Error("unused"); },
    }, async () => "unused");

    let failure: unknown;
    try {
      await agent.run(movie);
    } catch (error: unknown) {
      failure = error;
    }
    expect(failure).toBeInstanceOf(ComparisonAgentError);
    expect(failure).toMatchObject({
      code: "AGENT_ERROR",
      message: "No se pudo completar la comparación con el libro. Intenta de nuevo.",
    });
    expect(String(failure)).not.toContain("provider secret");
  });

  it("keeps the comparison criteria explicit and creates from Groq configuration offline", () => {
    expect(COMPARISON_CRITERIA).toHaveLength(4);
    expect(COMPARISON_CRITERIA.join(" ")).toContain("Temas y mensaje");
    expect(COMPARISON_INSTRUCTIONS).toContain("no uses conocimiento externo");
    expect(COMPARISON_INSTRUCTIONS).toContain("no hay información suficiente");

    const books = createComparisonAgentTools({
      searchBooks: async () => ({ results: [] }),
      getBookDetails: async () => ({
        volumeId: "volume-1",
        title: "Test book",
        authors: [],
        description: "Test description",
      }),
    });
    expect(() => createConfiguredComparisonAgent(books, {
      GROQ_API_KEY: "test-key",
      GROQ_MODEL: "test-model",
    })).not.toThrow();
    expect(() => createConfiguredComparisonAgent(books, {
      GROQ_MODEL: "test-model",
    })).toThrow("GROQ_API_KEY is required");
  });
});
