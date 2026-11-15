import { describe, expect, it } from "bun:test";
import { Value } from "@sinclair/typebox/value";
import {
  McpToolResponseSchemas,
  McpToolSchemas,
} from "@agichat/contracts";
import {
  createConfiguredMovieAgent,
  createMovieAgentTools,
  createMovieSdkTools,
  MovieAgent,
  MovieAgentError,
  type MovieAgentRuntime,
} from "../src/agents/movie.agent";
import {
  createMcpClients,
  McpClientError,
  type McpToolInvoker,
  type TmdbMcpClient,
} from "../src/mcp/mcp.clients";

const tmdbFixturePaths: Record<string, string> = {
  search_movies: "tmdb/search_movies.json",
  get_movie_details: "tmdb/get_movie_details.json",
  get_recommendations: "tmdb/get_recommendations.json",
};

async function readFixture(path: string): Promise<unknown> {
  return Bun.file(new URL(`./fixtures/mcp/${path}`, import.meta.url)).json();
}

function createTmdbFixtureInvoker(): McpToolInvoker {
  return {
    async callTool(name) {
      const fixturePath = tmdbFixturePaths[name];
      if (!fixturePath) throw new Error("Unknown fixture tool");
      const payload = await readFixture(fixturePath);
      return { structuredContent: payload };
    },
  };
}

function createBooksInvoker(): McpToolInvoker {
  return { callTool: async () => ({ structuredContent: { results: [] } }) };
}

function createAgent(
  tmdb: TmdbMcpClient,
  runtime: MovieAgentRuntime,
): MovieAgent {
  return new MovieAgent(createMovieAgentTools(tmdb), runtime);
}

describe("movie subagent", () => {
  it("uses only the TMDB MCP tools for searches, details and recommendations", async () => {
    const clients = createMcpClients({
      tmdb: createTmdbFixtureInvoker(),
      books: createBooksInvoker(),
    });
    const invokedTools: string[] = [];
    const agent = createAgent(clients.tmdb, async (prompt, tools) => {
      expect(prompt).toBe("Recomiéndame una película de ciencia ficción");
      const search = await tools.searchMovies({ query: "ciencia ficción" });
      invokedTools.push("search_movies");
      expect(Value.Check(McpToolResponseSchemas.tmdb.search_movies, search)).toBe(true);
      const details = await tools.getMovieDetails({ movieId: "603" });
      invokedTools.push("get_movie_details");
      expect(Value.Check(McpToolResponseSchemas.tmdb.get_movie_details, details)).toBe(true);
      const recommendations = await tools.getRecommendations({ movieId: "603" });
      invokedTools.push("get_recommendations");
      expect(Value.Check(McpToolResponseSchemas.tmdb.get_recommendations, recommendations)).toBe(true);
      return `Encontré ${search.results[0]?.imdb_id}; ${recommendations.results.length} recomendaciones.`;
    });

    await expect(agent.run("  Recomiéndame una película de ciencia ficción  ")).resolves.toContain(
      "tt0133093",
    );
    expect(invokedTools).toEqual([
      "search_movies",
      "get_movie_details",
      "get_recommendations",
    ]);
    await clients.close();
  });

  it("rejects blank and overlong prompts before invoking the model", async () => {
    let runtimeCalls = 0;
    const agent = createAgent({
      searchMovies: async () => ({ results: [] }),
      getMovieDetails: async () => { throw new Error("unused"); },
      getRecommendations: async () => ({ results: [] }),
    }, async () => {
      runtimeCalls += 1;
      return "unused";
    });

    await expect(agent.run("  ")).rejects.toMatchObject({ code: "INVALID_MESSAGE" });
    await expect(agent.run("x".repeat(2001))).rejects.toMatchObject({ code: "INVALID_MESSAGE" });
    expect(runtimeCalls).toBe(0);
  });

  it("converts model and MCP failures to a safe agent error", async () => {
    const agent = createAgent({
      searchMovies: async () => { throw new Error("provider secret"); },
      getMovieDetails: async () => { throw new Error("unused"); },
      getRecommendations: async () => { throw new Error("unused"); },
    }, async (_prompt, tools) => {
      await tools.searchMovies({ query: "Matrix" });
      return "unused";
    });

    let failure: unknown;
    try {
      await agent.run("Matrix");
    } catch (error: unknown) {
      failure = error;
    }
    expect(failure).toBeInstanceOf(MovieAgentError);
    expect(failure).toMatchObject({
      code: "AGENT_ERROR",
      message: "No se pudo completar la búsqueda de películas. Intenta de nuevo.",
    });
    expect(String(failure)).not.toContain("provider secret");
  });

  it("preserves stable MCP rate limit and upstream codes without provider details", async () => {
    for (const code of ["RATE_LIMITED", "UPSTREAM_ERROR"] as const) {
      const agent = createAgent({
        searchMovies: async () => { throw new McpClientError(code, "provider secret"); },
        getMovieDetails: async () => { throw new Error("unused"); },
        getRecommendations: async () => ({ results: [] }),
      }, async (_prompt, tools) => {
        await tools.searchMovies({ query: "Matrix" });
        return "unused";
      });

      await expect(agent.run("Matrix")).rejects.toMatchObject({ code });
      await expect(agent.run("Matrix")).rejects.not.toThrow("provider secret");
    }
  });

  it("exposes exactly the three contract-backed TMDB tools to the model", () => {
    const tools = createMovieSdkTools({
      searchMovies: async () => ({ results: [] }),
      getMovieDetails: async () => ({
        overview: "A hacker questions reality.",
        year: 1999,
        imdb_id: "tt0133093",
        poster_url: "https://image.tmdb.org/t/p/w500/matrix.jpg",
        rating: 8.2,
        genres: ["Science Fiction"],
      }),
      getRecommendations: async () => ({ results: [] }),
    });

    expect(Object.keys(tools)).toEqual([
      "search_movies",
      "get_movie_details",
      "get_recommendations",
    ]);
    expect(Value.Check(McpToolSchemas.search_movies, { query: "Matrix" })).toBe(true);
    expect(Value.Check(McpToolSchemas.get_movie_details, { movieId: "603" })).toBe(true);
  });

  it("builds from Groq configuration without making a provider request", () => {
    expect(() => createConfiguredMovieAgent({
      searchMovies: async () => ({ results: [] }),
      getMovieDetails: async () => { throw new Error("unused"); },
      getRecommendations: async () => ({ results: [] }),
    }, {
      GROQ_API_KEY: "test-key",
      GROQ_MODEL: "test-model",
    })).not.toThrow();
    expect(() => createConfiguredMovieAgent({
      searchMovies: async () => ({ results: [] }),
      getMovieDetails: async () => { throw new Error("unused"); },
      getRecommendations: async () => ({ results: [] }),
    }, { GROQ_MODEL: "test-model" })).toThrow("GROQ_API_KEY is required");
  });
});
