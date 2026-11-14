import { Elysia } from "elysia";
import { createBooksMcpHandler } from "./mcp.server";
import { BooksService } from "./books.service";

export interface BooksAppOptions { service?: BooksService }

export function createBooksApp(options: BooksAppOptions = {}) {
  const handler = createBooksMcpHandler(options.service);
  return new Elysia()
    .get("/health", () => ({ service: "books-mcp", status: "ok" }))
    .post("/mcp", ({ request }) => handler(request));
}

if (import.meta.main) {
  const port = Number(process.env.BOOKS_MCP_PORT ?? 3102);
  createBooksApp().listen(port);
  console.log(`Books MCP listening on port ${port}`);
}
