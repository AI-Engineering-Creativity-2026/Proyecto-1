import { Elysia } from "elysia";
import { createTmdbMcpHandler } from "./mcp.server";
import { TmdbService } from "./tmdb.service";

export interface TmdbAppOptions {
  service?: TmdbService;
}

export function createTmdbApp(options: TmdbAppOptions = {}) {
  const handler = createTmdbMcpHandler(options.service);
  return new Elysia()
    .get("/health", () => ({ service: "tmdb-mcp", status: "ok" }))
    .post("/mcp", ({ request }) => handler(request));
}

if (import.meta.main) {
  const port = Number(process.env.TMDB_MCP_PORT ?? 3101);
  createTmdbApp().listen(port);
  console.log(`TMDB MCP listening on port ${port}`);
}
