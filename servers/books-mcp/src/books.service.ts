import type { BookDetails, McpToolResponses } from "@agichat/contracts";
import { McpProviderError, McpRequestCache, readMcpCacheConfig } from "@agichat/mcp-shared";

const GOOGLE_BOOKS_API_ORIGIN = "https://www.googleapis.com";
const MAX_TITLE_LENGTH = 200;
const MAX_AUTHOR_LENGTH = 100;
const MAX_VOLUME_ID_LENGTH = 128;
const MAX_DESCRIPTION_LENGTH = 4_000;

type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export interface BooksServiceOptions {
  apiKey?: string;
  timeoutMs?: number;
  fetchImpl?: FetchLike;
  cache?: McpRequestCache;
}

interface GoogleVolume {
  id?: unknown;
  volumeInfo?: { title?: unknown; authors?: unknown; description?: unknown };
}

interface GoogleVolumesResponse { items?: unknown }

export class BooksService {
  private readonly apiKey: string | undefined;
  private readonly timeoutMs: number;
  private readonly fetchImpl: FetchLike;
  private readonly cache: McpRequestCache;

  public constructor(options: BooksServiceOptions = {}) {
    const config = readMcpCacheConfig({
      MCP_CACHE_TTL_MS: process.env.MCP_CACHE_TTL_MS,
      MCP_CACHE_MAX_ENTRIES: process.env.MCP_CACHE_MAX_ENTRIES,
      TMDB_DAILY_REQUEST_LIMIT: process.env.TMDB_DAILY_REQUEST_LIMIT,
      GOOGLE_BOOKS_DAILY_REQUEST_LIMIT: process.env.GOOGLE_BOOKS_DAILY_REQUEST_LIMIT,
    });
    this.apiKey = options.apiKey ?? process.env.GOOGLE_BOOKS_API_KEY;
    this.timeoutMs = validatePositiveInteger(options.timeoutMs ?? Number(process.env.GOOGLE_BOOKS_UPSTREAM_TIMEOUT_MS ?? 10_000), "El timeout de Google Books");
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.cache = options.cache ?? new McpRequestCache(config);
  }

  public async searchBooks(title: string, author?: string): Promise<McpToolResponses["books"]["search_books"]> {
    const safeTitle = validateText(title, MAX_TITLE_LENGTH, "El título");
    const safeAuthor = author === undefined ? undefined : validateText(author, MAX_AUTHOR_LENGTH, "El autor");
    const key = `search:${safeTitle}:${safeAuthor ?? "all"}`;
    return this.cache.getOrFetch("google_books", key, async () => {
      const query = safeAuthor === undefined ? safeTitle : `${safeTitle}+inauthor:${safeAuthor}`;
      const payload = await this.requestJson<GoogleVolumesResponse>(new URLSearchParams({ q: query, maxResults: "40" }));
      const results = asVolumes(payload.items).map((volume) => this.toBookDetails(volume)).filter((book): book is BookDetails => book !== undefined);
      return { results };
    });
  }

  public async getBookDetails(volumeId: string): Promise<BookDetails> {
    const safeVolumeId = validateVolumeId(volumeId);
    return this.cache.getOrFetch("google_books", `details:${safeVolumeId}`, async () => {
      const payload = await this.requestJson<GoogleVolume>(new URLSearchParams(), `/books/v1/volumes/${encodeURIComponent(safeVolumeId)}`);
      const book = this.toBookDetails({ ...payload, id: safeVolumeId });
      if (book === undefined) throw new McpProviderError("UPSTREAM_ERROR", "Google Books devolvió un libro incompleto.");
      return book;
    });
  }

  private toBookDetails(volume: GoogleVolume): BookDetails | undefined {
    const info = volume.volumeInfo;
    const id = typeof volume.id === "string" && volume.id.length > 0 ? volume.id : undefined;
    const title = typeof info?.title === "string" && info.title.trim().length > 0 ? info.title.slice(0, MAX_TITLE_LENGTH) : undefined;
    if (id === undefined || title === undefined) return undefined;
    return {
      volumeId: id,
      title,
      authors: Array.isArray(info.authors) ? info.authors.filter((author): author is string => typeof author === "string").map((author) => author.slice(0, MAX_AUTHOR_LENGTH)) : [],
      description: typeof info.description === "string" ? info.description.slice(0, MAX_DESCRIPTION_LENGTH) : "",
    };
  }

  private async requestJson<T>(params: URLSearchParams, path = "/books/v1/volumes"): Promise<T> {
    const url = new URL(path, GOOGLE_BOOKS_API_ORIGIN);
    for (const [key, value] of params) url.searchParams.set(key, value);
    if (this.apiKey) url.searchParams.set("key", this.apiKey);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetchImpl(url, { headers: { Accept: "application/json" }, signal: controller.signal });
      if (response.status === 429) throw new McpProviderError("RATE_LIMITED", "El proveedor externo está limitando solicitudes.");
      if (!response.ok) throw new Error("Google Books respondió con un estado no exitoso.");
      return (await response.json()) as T;
    } finally {
      clearTimeout(timeout);
    }
  }
}

function asVolumes(value: unknown): GoogleVolume[] {
  return Array.isArray(value) ? value.filter((item): item is GoogleVolume => typeof item === "object" && item !== null) : [];
}

function validateText(value: string, maxLength: number, label: string): string {
  if (typeof value !== "string" || value.trim().length === 0 || value.length > maxLength) throw new RangeError(`${label} debe tener entre 1 y ${maxLength} caracteres.`);
  return value.trim();
}

function validateVolumeId(value: string): string {
  if (typeof value !== "string" || value.trim().length === 0 || value.length > MAX_VOLUME_ID_LENGTH || /[\s/]/.test(value)) throw new RangeError("El identificador de volumen no es válido.");
  return value;
}

function validatePositiveInteger(value: number, name: string): number {
  if (!Number.isInteger(value) || value < 1) throw new RangeError(`${name} debe ser positivo.`);
  return value;
}
