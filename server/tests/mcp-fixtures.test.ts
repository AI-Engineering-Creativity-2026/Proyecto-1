import { describe, expect, it } from "bun:test";
import type { BookDetails, McpToolResponses, MovieDetails } from "@agichat/contracts";

const fixture = <T>(path: string): Promise<T> =>
  Bun.file(new URL(`./fixtures/mcp/${path}`, import.meta.url)).json() as Promise<T>;

const isMovieDetails = (value: MovieDetails): boolean =>
  (value.imdb_id === null || typeof value.imdb_id === "string") &&
  (value.poster_url === null || typeof value.poster_url === "string") &&
  typeof value.overview === "string" &&
  (value.rating === null || typeof value.rating === "number") &&
  Array.isArray(value.genres) &&
  value.genres.every((genre) => typeof genre === "string") &&
  (value.year === null || typeof value.year === "number");

const isBookDetails = (value: BookDetails): boolean =>
  typeof value.volumeId === "string" &&
  typeof value.title === "string" &&
  Array.isArray(value.authors) &&
  value.authors.every((author) => typeof author === "string") &&
  typeof value.description === "string";

describe("fixtures de herramientas MCP", () => {
  it("incluye respuestas TMDB para las tres herramientas", async () => {
    const search = await fixture<McpToolResponses["tmdb"]["search_movies"]>("tmdb/search_movies.json");
    const details = await fixture<McpToolResponses["tmdb"]["get_movie_details"]>("tmdb/get_movie_details.json");
    const recommendations = await fixture<McpToolResponses["tmdb"]["get_recommendations"]>("tmdb/get_recommendations.json");

    expect(search.results.length).toBeGreaterThan(0);
    expect(search.results.every(isMovieDetails)).toBe(true);
    expect(isMovieDetails(details)).toBe(true);
    expect(recommendations.results.length).toBeGreaterThan(0);
    expect(recommendations.results.every(isMovieDetails)).toBe(true);
  });

  it("incluye respuestas Google Books para las dos herramientas", async () => {
    const search = await fixture<McpToolResponses["books"]["search_books"]>("books/search_books.json");
    const details = await fixture<McpToolResponses["books"]["get_book_details"]>("books/get_book_details.json");

    expect(search.results.length).toBeGreaterThan(0);
    expect(search.results.every(isBookDetails)).toBe(true);
    expect(isBookDetails(details)).toBe(true);
  });

  it("usa URLs HTTPS de pósteres en los fixtures TMDB", async () => {
    const search = await fixture<McpToolResponses["tmdb"]["search_movies"]>("tmdb/search_movies.json");
    const details = await fixture<McpToolResponses["tmdb"]["get_movie_details"]>("tmdb/get_movie_details.json");
    const recommendations = await fixture<McpToolResponses["tmdb"]["get_recommendations"]>("tmdb/get_recommendations.json");
    const movies = [...search.results, details, ...recommendations.results];

    expect(movies.every((movie) => movie.poster_url?.startsWith("https://image.tmdb.org/") === true)).toBe(true);
  });
});
