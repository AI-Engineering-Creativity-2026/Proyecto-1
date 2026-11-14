import { describe, expect, it } from "bun:test";
import { BooksService } from "../../servers/books-mcp/src/books.service";
import { createBooksMcpHandler } from "../../servers/books-mcp/src/mcp.server";
import { TmdbService } from "../../servers/tmdb-mcp/src/tmdb.service";
import { createTmdbMcpHandler } from "../../servers/tmdb-mcp/src/mcp.server";
import {
  connectMcpClients,
  createMcpClients,
  McpClientError,
  readMcpClientConfig,
  type McpToolInvoker,
} from "../src/mcp/mcp.clients";

type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

const fixturePaths = {
  tmdb: {
    search_movies: "tmdb/search_movies.json",
    get_movie_details: "tmdb/get_movie_details.json",
    get_recommendations: "tmdb/get_recommendations.json",
  },
  books: {
    search_books: "books/search_books.json",
    get_book_details: "books/get_book_details.json",
  },
} as const;

async function readFixture(path: string): Promise<unknown> {
  const value: unknown = await Bun.file(
    new URL(`./fixtures/mcp/${path}`, import.meta.url),
  ).json();
  return value;
}

function createFixtureInvoker(paths: Record<string, string>): McpToolInvoker {
  return {
    async callTool(name) {
      const path = paths[name];
      if (path === undefined) throw new Error("Unknown fixture tool");
      const structuredContent = await readFixture(path);
      return {
        structuredContent,
        content: [{ type: "text", text: JSON.stringify(structuredContent) }],
      };
    },
  };
}

function jsonResponse(payload: unknown): Response {
  return Response.json(payload);
}

const tmdbFetch: FetchLike = async (input) => {
  const url = new URL(input.toString());
  if (url.pathname.endsWith("/configuration")) {
    return jsonResponse({
      images: { secure_base_url: "https://image.tmdb.org/t/p/", poster_sizes: ["w500"] },
    });
  }

  const movie = {
    imdb_id: "tt0133093",
    poster_path: "/matrix.jpg",
    overview: "A hacker questions reality.",
    vote_average: 8.2,
    release_date: "1999-03-31",
    genres: [{ name: "Science Fiction" }],
  };
  return url.pathname.includes("/search/movie") || url.pathname.includes("/recommendations")
    ? jsonResponse({ results: [movie] })
    : jsonResponse(movie);
};

const booksFetch: FetchLike = async () => jsonResponse({
  items: [{
    id: "volume-1",
    volumeInfo: {
      title: "The Matrix and Philosophy",
      authors: ["William Irwin"],
      description: "A book about The Matrix.",
    },
  }],
});

describe("MCP clients", () => {
  it("consumes both MCP contracts through fixture-backed invokers", async () => {
    const clients = createMcpClients({
      tmdb: createFixtureInvoker(fixturePaths.tmdb),
      books: createFixtureInvoker(fixturePaths.books),
    });

    await expect(clients.tmdb.searchMovies({ query: "matrix" })).resolves.toMatchObject({
      results: [{ imdb_id: "tt0133093" }],
    });
    await expect(clients.tmdb.getMovieDetails({ movieId: "603" })).resolves.toMatchObject({
      poster_url: "https://image.tmdb.org/t/p/w500/f89U3ADr1oiB1s9GkdPOEpXUk5H.jpg",
    });
    await expect(clients.tmdb.getRecommendations({ movieId: "603" })).resolves.toMatchObject({
      results: [{ imdb_id: "tt0083658" }, { imdb_id: "tt1375666" }],
    });
    await expect(clients.books.searchBooks({ title: "Matrix" })).resolves.toMatchObject({
      results: [{ volumeId: "zyTCAlFPjgYC" }],
    });
    await expect(clients.books.getBookDetails({ volumeId: "zyTCAlFPjgYC" })).resolves.toMatchObject({
      title: "The Matrix and Philosophy",
    });
    await clients.close();
  });

  it("connects to both Streamable HTTP services without external network", async () => {
    const tmdbHandler = createTmdbMcpHandler(new TmdbService({ fetchImpl: tmdbFetch }));
    const booksHandler = createBooksMcpHandler(new BooksService({ fetchImpl: booksFetch }));
    const fetchImpl: FetchLike = async (input, init) => {
      const url = new URL(input.toString());
      const handler = url.hostname === "tmdb.test" ? tmdbHandler : booksHandler;
      return handler(new Request(input, init));
    };
    const clients = await connectMcpClients({
      tmdbUrl: "http://tmdb.test/mcp",
      booksUrl: "http://books.test/mcp",
      fetchImpl,
    });

    await expect(clients.tmdb.searchMovies({ query: "matrix", year: 1999 })).resolves.toMatchObject({
      results: [{ year: 1999, poster_url: "https://image.tmdb.org/t/p/w500/matrix.jpg" }],
    });
    await expect(clients.books.searchBooks({ title: "Matrix", author: "Irwin" })).resolves.toMatchObject({
      results: [{ volumeId: "volume-1", authors: ["William Irwin"] }],
    });
    await clients.close();
  });

  it("rejects invalid inputs, invalid MCP responses and transport failures safely", async () => {
    const invalidResponseClients = createMcpClients({
      tmdb: { callTool: async () => ({ structuredContent: { invalid: true } }) },
      books: { callTool: async () => ({ structuredContent: {} }) },
    });
    await expect(invalidResponseClients.tmdb.searchMovies({ query: "matrix" })).rejects.toMatchObject({
      code: "UPSTREAM_ERROR",
      message: "El servicio MCP devolvió una respuesta inválida.",
    });
    await expect(invalidResponseClients.tmdb.searchMovies({ query: "" })).rejects.toMatchObject({
      code: "UPSTREAM_ERROR",
      message: "La solicitud no cumple el contrato MCP.",
    });

    const failedClients = createMcpClients({
      tmdb: { callTool: async () => { throw new Error("secret transport details"); } },
      books: createFixtureInvoker(fixturePaths.books),
    });
    let transportFailure: unknown;
    try {
      await failedClients.tmdb.searchMovies({ query: "matrix" });
    } catch (error: unknown) {
      transportFailure = error;
    }
    expect(transportFailure).toMatchObject({
      code: "UPSTREAM_ERROR",
      message: "No se pudo conectar con el servicio MCP.",
    });
    expect(String(transportFailure)).not.toContain("secret transport details");
  });

  it("preserves rate-limit codes from MCP error results without exposing details", async () => {
    const clients = createMcpClients({
      tmdb: {
        callTool: async () => ({
          isError: true,
          content: [{
            type: "text",
            text: JSON.stringify({ error: { code: "RATE_LIMITED", message: "upstream secret" } }),
          }],
        }),
      },
      books: createFixtureInvoker(fixturePaths.books),
    });

    await expect(clients.tmdb.searchMovies({ query: "matrix" })).rejects.toMatchObject({
      code: "RATE_LIMITED",
      message: "El servicio MCP alcanzó su límite de solicitudes.",
    });
    await expect(clients.tmdb.searchMovies({ query: "matrix" })).rejects.not.toThrow("upstream secret");
  });

  it("reads configurable endpoint URLs and rejects non-HTTP schemes", () => {
    expect(readMcpClientConfig({})).toEqual({
      tmdbUrl: "http://tmdb-mcp:3101/mcp",
      booksUrl: "http://books-mcp:3102/mcp",
    });
    expect(readMcpClientConfig({
      TMDB_MCP_URL: "https://tmdb.internal/mcp",
      BOOKS_MCP_URL: "http://books.internal/mcp",
    })).toEqual({
      tmdbUrl: "https://tmdb.internal/mcp",
      booksUrl: "http://books.internal/mcp",
    });
    expect(() => readMcpClientConfig({ TMDB_MCP_URL: "file:///etc/passwd" })).toThrow(
      "TMDB_MCP_URL debe usar HTTP o HTTPS.",
    );
  });

  it("exposes typed client failures as errors", () => {
    const error = new McpClientError("UPSTREAM_ERROR", "safe message");
    expect(error).toBeInstanceOf(Error);
    expect(error.code).toBe("UPSTREAM_ERROR");
  });
});
