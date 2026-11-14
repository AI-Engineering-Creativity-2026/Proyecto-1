import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { z } from "zod";
import { McpProviderError } from "@agichat/mcp-shared";
import { TmdbService } from "./tmdb.service";

export function createTmdbMcpHandler(service = new TmdbService()): (request: Request) => Promise<Response> {
  return async (request) => {
    const server = new McpServer(
      { name: "tmdb-mcp", version: "0.1.0" },
      { maxToolInputElements: 4 },
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
        inputSchema: { movieId: z.string().regex(/^\d{1,10}$/) },
      },
      async (args) => executeTool(() => service.getMovieDetails(String(args.movieId))),
    );
    registerTool(
      "get_recommendations",
      {
        description: "Obtiene recomendaciones de TMDB.",
        inputSchema: { movieId: z.string().regex(/^\d{1,10}$/) },
      },
      async (args) => executeTool(() => service.getRecommendations(String(args.movieId))),
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
