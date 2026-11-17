import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { z } from "zod";
import { McpProviderError } from "@agichat/mcp-shared";
import { TmdbService } from "./tmdb.service";

export function createTmdbMcpHandler(service = new TmdbService()): (request: Request) => Promise<Response> {
  return async (request) => {
    const server = new McpServer(
      { name: "tmdb-mcp", version: "0.1.0" },
      { maxToolInputElements: 8 },
    );
    const registerTool = server.registerTool.bind(server) as unknown as (
      name: string,
      config: { description: string; inputSchema: Record<string, unknown> },
      handler: (args: Record<string, unknown>) => Promise<unknown>,
    ) => void;

    registerTool(
      "search_movies",
      {
        description: "Busca películas en TMDB.",
        inputSchema: { query: z.string().min(1).max(100), year: z.number().int().optional() },
      },
      async (args) => executeTool(() => service.searchMovies(
        String(args.query),
        typeof args.year === "number" ? args.year : undefined,
      )),
    );
    registerTool(
      "get_movie_details",
      {
        description: "Obtiene detalles de una película de TMDB.",
        inputSchema: { movieId: z.string().regex(/^(?:\d{1,10}|tt\d{5,12})$/i) },
      },
      async (args) => executeTool(() => service.getMovieDetails(String(args.movieId))),
    );
    registerTool(
      "get_recommendations",
      {
        description: "Obtiene recomendaciones de TMDB.",
        inputSchema: { movieId: z.string().regex(/^(?:\d{1,10}|tt\d{5,12})$/i) },
      },
      async (args) => executeTool(() => service.getRecommendations(String(args.movieId))),
    );
    registerTool(
      "discover_movies",
      {
        description: "Descubre películas en TMDB por género, rango de años, orden e idioma.",
        inputSchema: {
          genres: z.array(z.string().min(1)).optional(),
          year_from: z.number().int().optional(),
          year_to: z.number().int().optional(),
          sort_by: z.enum(["popularity", "rating"]).optional(),
          min_votes: z.number().int().min(0).optional(),
          language: z.string().min(2).max(10).optional(),
        },
      },
      async (args) => executeTool(() => service.discoverMovies({
        ...(Array.isArray(args.genres) ? { genres: args.genres.map(String) } : {}),
        ...(typeof args.year_from === "number" ? { year_from: args.year_from } : {}),
        ...(typeof args.year_to === "number" ? { year_to: args.year_to } : {}),
        ...(args.sort_by === "popularity" || args.sort_by === "rating" ? { sort_by: args.sort_by } : {}),
        ...(typeof args.min_votes === "number" ? { min_votes: args.min_votes } : {}),
        ...(typeof args.language === "string" ? { language: args.language } : {}),
      })),
    );

    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
      maxRequestBodySize: 64 * 1024,
    });

    await server.connect(transport);
    try {
      return await transport.handleRequest(request);
    } finally {
      await transport.close();
      await server.close();
    }
  };
}

function toolResult(value: Record<string, unknown>) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(value) }],
    structuredContent: value,
  };
}

async function executeTool(operation: () => Promise<Record<string, unknown>>) {
  try {
    return toolResult(await operation());
  } catch (error) {
    return toolError(error);
  }
}

export function toolError(error: unknown) {
  const safeError = error instanceof McpProviderError
    ? { code: error.code, message: error.message }
    : { code: "UPSTREAM_ERROR", message: "El proveedor externo no está disponible." };
  return {
    isError: true,
    content: [{ type: "text" as const, text: JSON.stringify({ error: safeError }) }],
  };
}
