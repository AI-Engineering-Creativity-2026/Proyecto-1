import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { z } from "zod";
import { McpProviderError } from "@agichat/mcp-shared";
import { BooksService } from "./books.service";

export function createBooksMcpHandler(service = new BooksService()): (request: Request) => Promise<Response> {
  return async (request) => {
    const server = new McpServer({ name: "books-mcp", version: "0.1.0" }, { maxToolInputElements: 4 });
    const registerTool = server.registerTool.bind(server) as unknown as (
      name: string,
      config: { description: string; inputSchema: Record<string, unknown> },
      handler: (args: Record<string, unknown>) => Promise<unknown>,
    ) => void;
    registerTool("search_books", {
      description: "Busca libros en Google Books.",
      inputSchema: { title: z.string().min(1).max(200), author: z.string().min(1).max(100).optional() },
    }, (args) => executeTool(() => service.searchBooks(String(args.title), typeof args.author === "string" ? args.author : undefined)));
    registerTool("get_book_details", {
      description: "Obtiene detalles de un libro en Google Books.",
      inputSchema: { volumeId: z.string().min(1).max(128) },
    }, (args) => executeTool(() => service.getBookDetails(String(args.volumeId))));

    const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true, maxRequestBodySize: 64 * 1024 });
    await server.connect(transport);
    try {
      return await transport.handleRequest(request);
    } finally {
      await transport.close();
      await server.close();
    }
  };
}

async function executeTool(operation: () => Promise<Record<string, unknown>>) {
  try {
    return { content: [{ type: "text" as const, text: JSON.stringify(await operation()) }] };
  } catch (error) {
    const safeError = error instanceof McpProviderError
      ? { code: error.code, message: error.message }
      : { code: "UPSTREAM_ERROR", message: "El proveedor externo no está disponible." };
    return { isError: true, content: [{ type: "text" as const, text: JSON.stringify({ error: safeError }) }] };
  }
}
