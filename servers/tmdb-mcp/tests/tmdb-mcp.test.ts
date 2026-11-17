import { afterAll, describe, expect, test } from "bun:test";
import { Value } from "@sinclair/typebox/value";
import { Client } from "@modelcontextprotocol/sdk/client";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { MovieDetailsSchema, McpToolResponseSchemas } from "@agichat/contracts";
import { McpProviderError } from "@agichat/mcp-shared";
import { createTmdbMcpHandler } from "../src/mcp.server";
import { TmdbService } from "../src/tmdb.service";

const networkFetch = globalThis.fetch;
globalThis.fetch = (async () => {
  throw new Error("Las pruebas MCP no pueden acceder a la red.");
}) as unknown as typeof fetch;
afterAll(() => {
  globalThis.fetch = networkFetch;
});

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

const movie = {
  imdb_id: "tt0133093",
  poster_path: "/matrix.jpg",
  overview: "Texto de TMDB.",
  vote_average: 8.2,
  release_date: "1999-03-30",
  genres: [{ name: "Action" }],
};

function textContent(result: object): string {
  if (!("content" in result) || !Array.isArray(result.content)) return "";
  const first = result.content[0];
  return typeof first === "object" && first !== null && "type" in first && first.type === "text" && "text" in first && typeof first.text === "string"
    ? first.text
    : "";
}

function fakeFetch(input: RequestInfo | URL): Promise<Response> {
  const url = String(input);
  if (url.includes("configuration")) {
    return Promise.resolve(jsonResponse({
      images: { secure_base_url: "https://image.tmdb.org/t/p/", poster_sizes: ["w500"] },
    }));
  }
  if (url.includes("search/movie")) return Promise.resolve(jsonResponse({ results: [movie] }));
  if (url.includes("recommendations")) return Promise.resolve(jsonResponse({ results: [movie] }));
  return Promise.resolve(jsonResponse(movie));
}

describe("TmdbService", () => {
  test("mapea detalles y construye el póster con host fijo", async () => {
    const calls: string[] = [];
    const service = new TmdbService({
      apiReadAccessToken: "test-token",
      fetchImpl: async (input) => {
        calls.push(String(input));
        return fakeFetch(input);
      },
    });
    const result = await service.getMovieDetails("603");

    expect(result).toEqual({
      imdb_id: "tt0133093",
      poster_url: "https://image.tmdb.org/t/p/w500/matrix.jpg",
      overview: "Texto de TMDB.",
      rating: 8.2,
      genres: ["Action"],
      year: 1999,
    });
    expect(calls[0]).toContain("/3/movie/603");
    expect(calls[0]).not.toContain("test-token");
    expect(Value.Check(MovieDetailsSchema, result)).toBe(true);
  });

  test("mapea búsquedas vacías y recomendaciones", async () => {
    const service = new TmdbService({
      fetchImpl: async (input) => String(input).includes("search/movie")
        ? jsonResponse({ results: [] })
        : fakeFetch(input),
    });

    expect(await service.searchMovies("unknown")).toEqual({ results: [] });
    const recommendations = await service.getRecommendations("603");
    expect(Value.Check(McpToolResponseSchemas.tmdb.get_recommendations, recommendations)).toBe(true);
  });

  test("enriquece una recomendación con su IMDb ID usando un único lookup de detalles", async () => {
    const calls: string[] = [];
    const service = new TmdbService({
      fetchImpl: async (input) => {
        const url = String(input);
        calls.push(url);
        if (url.includes("configuration")) {
          return jsonResponse({ images: { secure_base_url: "https://image.tmdb.org/t/p/", poster_sizes: ["w500"] } });
        }
        if (url.includes("recommendations")) {
          return jsonResponse({ results: [{ ...movie, id: 603, imdb_id: null }] });
        }
        if (url.endsWith("/3/movie/603?language=es-MX")) return jsonResponse(movie);
        return jsonResponse({}, 404);
      },
    });

    const result = await service.getRecommendations("603");

    expect(result.results[0]?.imdb_id).toBe("tt0133093");
    expect(calls.filter((url) => url.includes("/3/movie/603?")).length).toBe(1);
    expect(Value.Check(McpToolResponseSchemas.tmdb.get_recommendations, result)).toBe(true);
  });

  test("enriquece el primer resultado de búsqueda con IMDb para emitir su enlace", async () => {
    const calls: string[] = [];
    const service = new TmdbService({
      fetchImpl: async (input) => {
        const url = String(input);
        calls.push(url);
        if (url.includes("configuration")) {
          return jsonResponse({ images: { secure_base_url: "https://image.tmdb.org/t/p/", poster_sizes: ["w500"] } });
        }
        if (url.includes("search/movie")) {
          return jsonResponse({ results: [{ ...movie, id: 603, imdb_id: null }] });
        }
        if (url.endsWith("/3/movie/603?language=es-MX")) return jsonResponse(movie);
        return jsonResponse({}, 404);
      },
    });

    const result = await service.searchMovies("Matrix");

    expect(result.results[0]?.imdb_id).toBe("tt0133093");
    expect(calls.filter((url) => url.includes("/3/movie/603?")).length).toBe(1);
    expect(Value.Check(McpToolResponseSchemas.tmdb.search_movies, result)).toBe(true);
  });

  test("limita el enriquecimiento de IMDb a los tres resultados presentables", async () => {
    const detailLookups: string[] = [];
    const recommendations = Array.from({ length: 5 }, (_, index) => ({
      ...movie,
      id: 600 + index,
      imdb_id: null,
    }));
    const service = new TmdbService({
      fetchImpl: async (input) => {
        const url = String(input);
        if (url.includes("configuration")) {
          return jsonResponse({ images: { secure_base_url: "https://image.tmdb.org/t/p/", poster_sizes: ["w500"] } });
        }
        if (url.includes("recommendations")) return jsonResponse({ results: recommendations });
        if (/\/3\/movie\/\d+\?/.test(url)) {
          detailLookups.push(url);
          return jsonResponse(movie);
        }
        return jsonResponse({}, 404);
      },
    });

    const result = await service.getRecommendations("603");

    expect(detailLookups).toHaveLength(3);
    expect(result.results.slice(0, 3).every((item) => item.imdb_id === "tt0133093")).toBe(true);
    expect(Value.Check(McpToolResponseSchemas.tmdb.get_recommendations, result)).toBe(true);
  });

  test("conserva recomendaciones si falla el lookup opcional de IMDb", async () => {
    const service = new TmdbService({
      fetchImpl: async (input) => {
        const url = String(input);
        if (url.includes("configuration")) {
          return jsonResponse({ images: { secure_base_url: "https://image.tmdb.org/t/p/", poster_sizes: ["w500"] } });
        }
        if (url.includes("recommendations")) {
          return jsonResponse({ results: [{ ...movie, id: 603, imdb_id: null }] });
        }
        return jsonResponse({}, 503);
      },
    });

    await expect(service.getRecommendations("603")).resolves.toMatchObject({
      results: [{ imdb_id: null, poster_url: "https://image.tmdb.org/t/p/w500/matrix.jpg" }],
    });
  });

  test("descubre películas por género resolviendo y cacheando la lista de géneros", async () => {
    const urls: string[] = [];
    const service = new TmdbService({
      fetchImpl: async (input) => {
        const url = String(input);
        urls.push(url);
        if (url.includes("configuration")) {
          return jsonResponse({ images: { secure_base_url: "https://image.tmdb.org/t/p/", poster_sizes: ["w500"] } });
        }
        if (url.includes("/3/genre/movie/list")) {
          return jsonResponse({
            genres: [
              { id: 878, name: "Ciencia ficción" },
              { id: 28, name: "Acción" },
            ],
          });
        }
        if (url.includes("/3/discover/movie")) {
          return jsonResponse({
            results: [{ ...movie, id: 603, title: "Blade Runner", imdb_id: null }],
          });
        }
        if (url.includes("/3/movie/603")) return jsonResponse({ ...movie, title: "Blade Runner" });
        return jsonResponse({}, 404);
      },
    });

    const first = await service.discoverMovies({
      genres: ["ciencia ficción"],
      year_from: 1980,
      year_to: 2025,
      sort_by: "rating",
      min_votes: 500,
    });
    const second = await service.discoverMovies({ genres: ["Science Fiction"] });

    expect(first.results[0]).toMatchObject({
      title: "Blade Runner",
      imdb_id: "tt0133093",
      poster_url: "https://image.tmdb.org/t/p/w500/matrix.jpg",
    });
    expect(second.results).toHaveLength(1);
    expect(urls.filter((u) => u.includes("/3/genre/movie/list"))).toHaveLength(1);
    const discoverUrl = urls.find((u) => u.includes("/3/discover/movie")) ?? "";
    expect(discoverUrl).toContain("with_genres=878");
    expect(discoverUrl).toContain("vote_count.gte=500");
    expect(discoverUrl).toContain("sort_by=vote_average.desc");
    expect(discoverUrl).toContain("primary_release_date.gte=1980-01-01");
    expect(discoverUrl).toContain("primary_release_date.lte=2025-12-31");
    expect(Value.Check(McpToolResponseSchemas.tmdb.discover_movies, first)).toBe(true);
  });

  test("usa fallback seguro si falla la configuración de imágenes", async () => {
    const service = new TmdbService({
      fetchImpl: async (input) => String(input).includes("configuration")
        ? jsonResponse({}, 500)
        : jsonResponse(movie),
    });
    await expect(service.getMovieDetails("603")).resolves.toMatchObject({
      poster_url: "https://image.tmdb.org/t/p/w500/matrix.jpg",
    });
  });

  test("valida y limita entradas", async () => {
    const service = new TmdbService({ fetchImpl: async () => jsonResponse(movie) });
    await expect(service.searchMovies(" ")).rejects.toThrow();
    await expect(service.searchMovies("x".repeat(101))).rejects.toThrow();
    await expect(service.getMovieDetails("../603")).rejects.toThrow();
    await expect(service.searchMovies("x", 1887)).rejects.toThrow();
  });

  test("mapea fallos upstream sin filtrar detalles", async () => {
    const service = new TmdbService({ fetchImpl: async () => jsonResponse({ secret: "hidden" }, 500) });
    await expect(service.searchMovies("matrix")).rejects.toEqual(
      expect.objectContaining({ code: "UPSTREAM_ERROR", message: "El proveedor externo no está disponible." }),
    );
  });
});

describe("tmdb-mcp Streamable HTTP", () => {
  test("publica las tres herramientas mediante el SDK y devuelve JSON estructurado", async () => {
    const service = new TmdbService({ fetchImpl: fakeFetch });
    const handler = createTmdbMcpHandler(service);
    const transport = new StreamableHTTPClientTransport(new URL("http://tmdb.test/mcp"), {
      fetch: (input, init) => handler(new Request(input, init)),
    });
    const client = new Client({ name: "test-client", version: "1.0.0" });

    await client.connect(transport);
    const tools = await client.listTools();
    expect(tools.tools.map((tool) => tool.name)).toEqual([
      "search_movies",
      "get_movie_details",
      "get_recommendations",
      "discover_movies",
    ]);
    const result = await client.callTool({ name: "get_movie_details", arguments: { movieId: "603" } });
    expect(result.isError).not.toBe(true);
    expect(JSON.parse(textContent(result))).toMatchObject({
      imdb_id: "tt0133093",
    });
    await client.close();
  });

  test("expone errores estructurados sin secretos", async () => {
    const service = new TmdbService({ fetchImpl: async () => jsonResponse({}, 429) });
    const handler = createTmdbMcpHandler(service);
    const transport = new StreamableHTTPClientTransport(new URL("http://tmdb.test/mcp"), {
      fetch: (input, init) => handler(new Request(input, init)),
    });
    const client = new Client({ name: "test-client", version: "1.0.0" });
    await client.connect(transport);
    const result = await client.callTool({ name: "search_movies", arguments: { query: "matrix" } });
    expect(result.isError).toBe(true);
    expect(textContent(result)).toContain("RATE_LIMITED");
    expect(textContent(result)).not.toContain("429");
    await client.close();
  });
});

test("el error de presupuesto conserva el código del contrato", () => {
  const error = new McpProviderError("RATE_LIMITED", "Se alcanzó el límite diario del proveedor.");
  expect(error.code).toBe("RATE_LIMITED");
});
