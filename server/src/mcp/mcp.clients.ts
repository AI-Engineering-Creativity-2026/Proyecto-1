import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { Value } from "@sinclair/typebox/value";
import type { Static, TSchema } from "@sinclair/typebox";
import {
  McpToolResponseSchemas,
  McpToolSchemas,
} from "@agichat/contracts";

type SearchMoviesInput = Static<typeof McpToolSchemas.search_movies>;
type MovieIdInput = Static<typeof McpToolSchemas.get_movie_details>;
type DiscoverMoviesInput = Static<typeof McpToolSchemas.discover_movies>;
type SearchBooksInput = Static<typeof McpToolSchemas.search_books>;
type BookIdInput = Static<typeof McpToolSchemas.get_book_details>;

type SearchMoviesResult = Static<typeof McpToolResponseSchemas.tmdb.search_movies>;
type MovieDetailsResult = Static<typeof McpToolResponseSchemas.tmdb.get_movie_details>;
type RecommendationsResult = Static<typeof McpToolResponseSchemas.tmdb.get_recommendations>;
type DiscoverMoviesResult = Static<typeof McpToolResponseSchemas.tmdb.discover_movies>;
type SearchBooksResult = Static<typeof McpToolResponseSchemas.books.search_books>;
type BookDetailsResult = Static<typeof McpToolResponseSchemas.books.get_book_details>;
type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export type McpClientErrorCode = "RATE_LIMITED" | "UPSTREAM_ERROR";

export class McpClientError extends Error {
  constructor(
    public readonly code: McpClientErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "McpClientError";
  }
}

export interface McpToolInvoker {
  callTool(name: string, arguments_: Record<string, unknown>): Promise<unknown>;
  close?: () => Promise<void>;
}

export interface TmdbMcpClient {
  searchMovies(input: SearchMoviesInput): Promise<SearchMoviesResult>;
  getMovieDetails(input: MovieIdInput): Promise<MovieDetailsResult>;
  getRecommendations(input: MovieIdInput): Promise<RecommendationsResult>;
  discoverMovies(input: DiscoverMoviesInput): Promise<DiscoverMoviesResult>;
}

export interface BooksMcpClient {
  searchBooks(input: SearchBooksInput): Promise<SearchBooksResult>;
  getBookDetails(input: BookIdInput): Promise<BookDetailsResult>;
}

export interface McpClients {
  tmdb: TmdbMcpClient;
  books: BooksMcpClient;
  close(): Promise<void>;
}

export interface McpClientDependencies {
  tmdb: McpToolInvoker;
  books: McpToolInvoker;
}

export interface McpClientConfig {
  tmdbUrl: string;
  booksUrl: string;
  fetchImpl?: FetchLike;
}

export interface McpClientEnvironment extends Record<string, string | undefined> {
  TMDB_MCP_URL?: string;
  BOOKS_MCP_URL?: string;
}

const INVALID_RESPONSE_MESSAGE = "El servicio MCP devolvió una respuesta inválida.";
const TOOL_ERROR_MESSAGE = "El servicio MCP no pudo procesar la solicitud.";
const TRANSPORT_ERROR_MESSAGE = "No se pudo conectar con el servicio MCP.";

export function createMcpClients(dependencies: McpClientDependencies): McpClients {
  return {
    tmdb: {
      searchMovies: (input) => callTool(
        dependencies.tmdb,
        "search_movies",
        McpToolSchemas.search_movies,
        McpToolResponseSchemas.tmdb.search_movies,
        input,
      ),
      getMovieDetails: (input) => callTool(
        dependencies.tmdb,
        "get_movie_details",
        McpToolSchemas.get_movie_details,
        McpToolResponseSchemas.tmdb.get_movie_details,
        input,
      ),
      getRecommendations: (input) => callTool(
        dependencies.tmdb,
        "get_recommendations",
        McpToolSchemas.get_recommendations,
        McpToolResponseSchemas.tmdb.get_recommendations,
        input,
      ),
      discoverMovies: (input) => callTool(
        dependencies.tmdb,
        "discover_movies",
        McpToolSchemas.discover_movies,
        McpToolResponseSchemas.tmdb.discover_movies,
        input,
      ),
    },
    books: {
      searchBooks: (input) => callTool(
        dependencies.books,
        "search_books",
        McpToolSchemas.search_books,
        McpToolResponseSchemas.books.search_books,
        input,
      ),
      getBookDetails: (input) => callTool(
        dependencies.books,
        "get_book_details",
        McpToolSchemas.get_book_details,
        McpToolResponseSchemas.books.get_book_details,
        input,
      ),
    },
    async close() {
      await Promise.allSettled([
        dependencies.tmdb.close?.(),
        dependencies.books.close?.(),
      ]);
    },
  };
}

export function readMcpClientConfig(
  environment: McpClientEnvironment = process.env,
): McpClientConfig {
  return {
    tmdbUrl: validateEndpoint(
      environment.TMDB_MCP_URL ?? "http://tmdb-mcp:3101/mcp",
      "TMDB_MCP_URL",
    ),
    booksUrl: validateEndpoint(
      environment.BOOKS_MCP_URL ?? "http://books-mcp:3102/mcp",
      "BOOKS_MCP_URL",
    ),
  };
}

export async function connectMcpClients(
  config: McpClientConfig = readMcpClientConfig(),
): Promise<McpClients> {
  const tmdbUrl = validateEndpoint(config.tmdbUrl, "TMDB_MCP_URL");
  const booksUrl = validateEndpoint(config.booksUrl, "BOOKS_MCP_URL");
  const tmdbInvoker = await connectToolInvoker("tmdb-mcp", tmdbUrl, config.fetchImpl);
  try {
    const booksInvoker = await connectToolInvoker("books-mcp", booksUrl, config.fetchImpl);
    return createMcpClients({ tmdb: tmdbInvoker, books: booksInvoker });
  } catch (error) {
    await tmdbInvoker.close?.().catch(() => undefined);
    throw error;
  }
}

async function connectToolInvoker(
  name: string,
  endpoint: string,
  fetchImpl?: FetchLike,
): Promise<McpToolInvoker> {
  const client = new Client({ name: "agichat-server", version: "0.1.0" });
  const transport = new StreamableHTTPClientTransport(
    new URL(endpoint),
    fetchImpl ? { fetch: fetchImpl } : undefined,
  );

  try {
    await client.connect(transport);
  } catch {
    await client.close().catch(() => undefined);
    throw new McpClientError("UPSTREAM_ERROR", `${TRANSPORT_ERROR_MESSAGE} (${name}).`);
  }

  return {
    callTool: (toolName, arguments_) => client.callTool({
      name: toolName,
      arguments: arguments_,
    }),
    close: () => client.close(),
  };
}

async function callTool<InputSchema extends TSchema, ResponseSchema extends TSchema>(
  invoker: McpToolInvoker,
  name: string,
  inputSchema: InputSchema,
  responseSchema: ResponseSchema,
  input: Static<InputSchema> & Record<string, unknown>,
): Promise<Static<ResponseSchema>> {
  if (!Value.Check(inputSchema, input)) {
    throw new McpClientError("UPSTREAM_ERROR", "La solicitud no cumple el contrato MCP.");
  }

  let rawResult: unknown;
  try {
    rawResult = await invoker.callTool(name, input);
  } catch {
    throw new McpClientError("UPSTREAM_ERROR", TRANSPORT_ERROR_MESSAGE);
  }

  const payload = readToolPayload(rawResult);
  if (!Value.Check(responseSchema, payload)) {
    throw new McpClientError("UPSTREAM_ERROR", INVALID_RESPONSE_MESSAGE);
  }
  return payload;
}

function readToolPayload(result: unknown): unknown {
  if (!isRecord(result)) {
    throw new McpClientError("UPSTREAM_ERROR", INVALID_RESPONSE_MESSAGE);
  }

  if (result.isError === true) {
    throw toolError(result.content);
  }

  if (result.structuredContent !== undefined) return result.structuredContent;
  if (!Array.isArray(result.content)) {
    throw new McpClientError("UPSTREAM_ERROR", INVALID_RESPONSE_MESSAGE);
  }

  for (const item of result.content) {
    if (!isRecord(item) || item.type !== "text" || typeof item.text !== "string") continue;
    try {
      const parsed: unknown = JSON.parse(item.text);
      return parsed;
    } catch {
      throw new McpClientError("UPSTREAM_ERROR", INVALID_RESPONSE_MESSAGE);
    }
  }

  throw new McpClientError("UPSTREAM_ERROR", INVALID_RESPONSE_MESSAGE);
}

function toolError(content: unknown): McpClientError {
  const errorCode = readRemoteErrorCode(content);
  return errorCode === "RATE_LIMITED"
    ? new McpClientError("RATE_LIMITED", "El servicio MCP alcanzó su límite de solicitudes.")
    : new McpClientError("UPSTREAM_ERROR", TOOL_ERROR_MESSAGE);
}

function readRemoteErrorCode(content: unknown): McpClientErrorCode | undefined {
  if (!Array.isArray(content)) return undefined;
  for (const item of content) {
    if (!isRecord(item) || item.type !== "text" || typeof item.text !== "string") continue;
    try {
      const parsed: unknown = JSON.parse(item.text);
      if (!isRecord(parsed) || !isRecord(parsed.error)) continue;
      if (parsed.error.code === "RATE_LIMITED") return "RATE_LIMITED";
      if (parsed.error.code === "UPSTREAM_ERROR") return "UPSTREAM_ERROR";
    } catch {
      return undefined;
    }
  }
  return undefined;
}

function validateEndpoint(value: string, name: string): string {
  let endpoint: URL;
  try {
    endpoint = new URL(value);
  } catch {
    throw new RangeError(`${name} debe ser una URL HTTP o HTTPS válida.`);
  }
  if (endpoint.protocol !== "http:" && endpoint.protocol !== "https:") {
    throw new RangeError(`${name} debe usar HTTP o HTTPS.`);
  }
  return endpoint.toString();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
