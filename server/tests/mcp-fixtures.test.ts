import { describe, expect, it } from "bun:test";
import { Value } from "@sinclair/typebox/value";
import {
  ErrorCodeSchema,
  McpToolResponseSchemas,
  type McpToolResponses,
} from "@agichat/contracts";

const fixture = <T>(path: string): Promise<T> =>
  Bun.file(new URL(`./fixtures/mcp/${path}`, import.meta.url)).json() as Promise<T>;

describe("fixtures de herramientas MCP", () => {
  it("incluye respuestas TMDB para las tres herramientas", async () => {
    const search = await fixture<McpToolResponses["tmdb"]["search_movies"]>("tmdb/search_movies.json");
    const details = await fixture<McpToolResponses["tmdb"]["get_movie_details"]>("tmdb/get_movie_details.json");
    const recommendations = await fixture<McpToolResponses["tmdb"]["get_recommendations"]>("tmdb/get_recommendations.json");

    expect(search.results.length).toBeGreaterThan(0);
    expect(Value.Check(McpToolResponseSchemas.tmdb.search_movies, search)).toBe(true);
    expect(Value.Check(McpToolResponseSchemas.tmdb.get_movie_details, details)).toBe(true);
    expect(recommendations.results.length).toBeGreaterThan(0);
    expect(Value.Check(McpToolResponseSchemas.tmdb.get_recommendations, recommendations)).toBe(true);
  });

  it("incluye respuestas Google Books para las dos herramientas", async () => {
    const search = await fixture<McpToolResponses["books"]["search_books"]>("books/search_books.json");
    const details = await fixture<McpToolResponses["books"]["get_book_details"]>("books/get_book_details.json");

    expect(search.results.length).toBeGreaterThan(0);
    expect(Value.Check(McpToolResponseSchemas.books.search_books, search)).toBe(true);
    expect(Value.Check(McpToolResponseSchemas.books.get_book_details, details)).toBe(true);
  });

  it("usa URLs HTTPS de pósteres en los fixtures TMDB", async () => {
    const search = await fixture<McpToolResponses["tmdb"]["search_movies"]>("tmdb/search_movies.json");
    const details = await fixture<McpToolResponses["tmdb"]["get_movie_details"]>("tmdb/get_movie_details.json");
    const recommendations = await fixture<McpToolResponses["tmdb"]["get_recommendations"]>("tmdb/get_recommendations.json");
    const movies = [...search.results, details, ...recommendations.results];

    expect(movies.every((movie) => movie.poster_url?.startsWith("https://image.tmdb.org/") === true)).toBe(true);
  });

  it("cubre búsquedas sin resultados y contenido de inyección no confiable", async () => {
    const emptyMovies = await fixture<McpToolResponses["tmdb"]["search_movies"]>("tmdb/search_movies_empty.json");
    const emptyBooks = await fixture<McpToolResponses["books"]["search_books"]>("books/search_books_empty.json");
    const injection = await fixture<McpToolResponses["tmdb"]["search_movies"]>("tmdb/search_movies_prompt_injection.json");

    expect(Value.Check(McpToolResponseSchemas.tmdb.search_movies, emptyMovies)).toBe(true);
    expect(Value.Check(McpToolResponseSchemas.books.search_books, emptyBooks)).toBe(true);
    expect(injection.results[0]?.overview).toContain("Ignore all previous instructions");
  });

  it("mantiene códigos de error del contrato para fallos de proveedores", async () => {
    const upstream = await fixture<{ error: { code: string; message: string } }>("errors/upstream_error.json");
    const rateLimited = await fixture<{ error: { code: string; message: string } }>("errors/rate_limited.json");

    expect(Value.Check(ErrorCodeSchema, upstream.error.code)).toBe(true);
    expect(Value.Check(ErrorCodeSchema, rateLimited.error.code)).toBe(true);
    expect(upstream.error.code).toBe("UPSTREAM_ERROR");
    expect(rateLimited.error.code).toBe("RATE_LIMITED");
    expect(upstream.error.message.length).toBeGreaterThan(0);
    expect(rateLimited.error.message.length).toBeGreaterThan(0);
  });
});
