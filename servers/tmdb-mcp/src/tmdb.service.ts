import type { McpToolResponses, MovieDetails } from "@agichat/contracts";
import { McpProviderError, McpRequestCache, readMcpCacheConfig } from "@agichat/mcp-shared";

const TMDB_API_ORIGIN = "https://api.themoviedb.org";
const POSTER_ORIGIN = "https://image.tmdb.org";
const DEFAULT_POSTER_BASE = `${POSTER_ORIGIN}/t/p/w500`;
const MAX_QUERY_LENGTH = 100;
const MAX_OVERVIEW_LENGTH = 4_000;

type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export interface TmdbServiceOptions {
  apiReadAccessToken?: string;
  apiKey?: string;
  language?: string;
  timeoutMs?: number;
  fetchImpl?: FetchLike;
  cache?: McpRequestCache;
}

interface TmdbMovie {
  imdb_id?: unknown;
  poster_path?: unknown;
  overview?: unknown;
  vote_average?: unknown;
  release_date?: unknown;
  genres?: unknown;
}

interface TmdbSearchResponse {
  results?: unknown;
}

interface TmdbConfigurationResponse {
  images?: { secure_base_url?: unknown; poster_sizes?: unknown };
}

export class TmdbService {
  private readonly token: string | undefined;
  private readonly apiKey: string | undefined;
  private readonly language: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl: FetchLike;
  private readonly cache: McpRequestCache;

  public constructor(options: TmdbServiceOptions = {}) {
    const config = readMcpCacheConfig({
      MCP_CACHE_TTL_MS: process.env.MCP_CACHE_TTL_MS,
      MCP_CACHE_MAX_ENTRIES: process.env.MCP_CACHE_MAX_ENTRIES,
      TMDB_DAILY_REQUEST_LIMIT: process.env.TMDB_DAILY_REQUEST_LIMIT,
      GOOGLE_BOOKS_DAILY_REQUEST_LIMIT: process.env.GOOGLE_BOOKS_DAILY_REQUEST_LIMIT,
    });
    this.token = options.apiReadAccessToken ?? process.env.TMDB_API_READ_ACCESS_TOKEN;
    this.apiKey = options.apiKey ?? process.env.TMDB_API_KEY;
    this.language = validateLanguage(options.language ?? process.env.TMDB_API_LANGUAGE ?? "es-MX");
    this.timeoutMs = validatePositiveInteger(
      options.timeoutMs ?? Number(process.env.TMDB_UPSTREAM_TIMEOUT_MS ?? 10_000),
      "El timeout de TMDB",
    );
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.cache = options.cache ?? new McpRequestCache(config);
  }

  public async searchMovies(query: string, year?: number): Promise<McpToolResponses["tmdb"]["search_movies"]> {
    const safeQuery = validateQuery(query);
    const safeYear = validateYear(year);
    const key = `search:${this.language}:${safeQuery}:${safeYear ?? "all"}`;
    return this.cache.getOrFetch("tmdb", key, async () => {
      const params = new URLSearchParams({ query: safeQuery, language: this.language });
      if (safeYear !== undefined) params.set("year", String(safeYear));
      const payload = await this.requestJson<TmdbSearchResponse>("/3/search/movie", params);
      const results = await Promise.all(asMovies(payload.results).map((movie) => this.toMovieDetails(movie)));
      return { results };
    });
  }

  public async getMovieDetails(movieId: string): Promise<MovieDetails> {
    const safeMovieId = validateMovieId(movieId);
    return this.cache.getOrFetch("tmdb", `details:${this.language}:${safeMovieId}`, async () => {
      const payload = await this.requestJson<TmdbMovie>(
        `/3/movie/${safeMovieId}`,
        new URLSearchParams({ language: this.language }),
      );
      return this.toMovieDetails(payload);
    });
  }

  public async getRecommendations(movieId: string): Promise<McpToolResponses["tmdb"]["get_recommendations"]> {
    const safeMovieId = validateMovieId(movieId);
    return this.cache.getOrFetch("tmdb", `recommendations:${this.language}:${safeMovieId}`, async () => {
      const payload = await this.requestJson<TmdbSearchResponse>(
        `/3/movie/${safeMovieId}/recommendations`,
        new URLSearchParams({ language: this.language }),
      );
      const results = await Promise.all(asMovies(payload.results).map((movie) => this.toMovieDetails(movie)));
      return { results };
    });
  }

  private async toMovieDetails(movie: TmdbMovie): Promise<MovieDetails> {
    const posterBase = await this.getPosterBase();
    return {
      imdb_id: typeof movie.imdb_id === "string" && movie.imdb_id.length > 0 ? movie.imdb_id : null,
      poster_url: buildPosterUrl(posterBase, movie.poster_path),
      overview: limitThirdPartyText(movie.overview),
      rating: typeof movie.vote_average === "number" && Number.isFinite(movie.vote_average)
        ? movie.vote_average
        : null,
      genres: Array.isArray(movie.genres)
        ? movie.genres.flatMap((genre) =>
            typeof genre === "object" && genre !== null && "name" in genre && typeof genre.name === "string"
              ? [limitThirdPartyText(genre.name)]
              : [],
          )
        : [],
      year: getYear(movie.release_date),
    };
  }

  private async getPosterBase(): Promise<string> {
    return this.cache.getOrFetch("tmdb", "configuration:images", async () => {
      try {
        const payload = await this.requestJson<TmdbConfigurationResponse>("/3/configuration", new URLSearchParams());
        const base = payload.images?.secure_base_url;
        const sizes = payload.images?.poster_sizes;
        if (typeof base !== "string" || !Array.isArray(sizes)) return DEFAULT_POSTER_BASE;
        const size = sizes.includes("w500") ? "w500" : sizes.find((item) => typeof item === "string");
        if (typeof size !== "string") return DEFAULT_POSTER_BASE;
        const candidate = `${base}${size}`;
        return isSafePosterUrl(`${candidate}/poster.jpg`) ? candidate : DEFAULT_POSTER_BASE;
      } catch {
        return DEFAULT_POSTER_BASE;
      }
    });
  }

  private async requestJson<T>(path: string, params: URLSearchParams): Promise<T> {
    const url = new URL(path, TMDB_API_ORIGIN);
    url.search = params.toString();
    const headers = new Headers({ Accept: "application/json" });
    if (this.token) headers.set("Authorization", `Bearer ${this.token}`);
    else if (this.apiKey) url.searchParams.set("api_key", this.apiKey);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetchImpl(url, { headers, signal: controller.signal });
      if (response.status === 429) {
        throw new McpProviderError("RATE_LIMITED", "El proveedor externo está limitando solicitudes.");
      }
      if (!response.ok) throw new Error("TMDB respondió con un estado no exitoso.");
      return (await response.json()) as T;
    } finally {
      clearTimeout(timeout);
    }
  }
}

function asMovies(value: unknown): TmdbMovie[] {
  return Array.isArray(value) ? value.filter(isMovie) : [];
}

function isMovie(value: unknown): value is TmdbMovie {
  return typeof value === "object" && value !== null;
}

function validateQuery(value: string): string {
  if (typeof value !== "string" || value.trim().length === 0 || value.length > MAX_QUERY_LENGTH) {
    throw new RangeError("La búsqueda debe tener entre 1 y 100 caracteres.");
  }
  return value.trim();
}

function validateMovieId(value: string): string {
  if (!/^\d{1,10}$/.test(value)) throw new RangeError("El identificador de película no es válido.");
  return value;
}

function validateYear(value: number | undefined): number | undefined {
  if (value === undefined) return undefined;
  if (!Number.isInteger(value) || value < 1888 || value > 2100) throw new RangeError("El año de película no es válido.");
  return value;
}

function validateLanguage(value: string): string {
  if (!/^[a-z]{2,3}(?:-[A-Z]{2})?$/.test(value)) throw new RangeError("El idioma de TMDB no es válido.");
  return value;
}

function validatePositiveInteger(value: number, name: string): number {
  if (!Number.isInteger(value) || value < 1) throw new RangeError(`${name} debe ser positivo.`);
  return value;
}

function limitThirdPartyText(value: unknown): string {
  return typeof value === "string" ? value.slice(0, MAX_OVERVIEW_LENGTH) : "";
}

function getYear(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const year = Number(value.slice(0, 4));
  return Number.isInteger(year) && year >= 1800 && year <= 2100 ? year : null;
}

function buildPosterUrl(base: string, posterPath: unknown): string | null {
  if (typeof posterPath !== "string" || posterPath.length === 0) return null;
  const candidate = `${base.replace(/\/$/, "")}/${posterPath.replace(/^\//, "")}`;
  return isSafePosterUrl(candidate) ? candidate : null;
}

function isSafePosterUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === "image.tmdb.org";
  } catch {
    return false;
  }
}
