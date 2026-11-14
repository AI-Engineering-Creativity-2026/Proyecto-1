import { afterAll, describe, expect, test } from "bun:test";
import { Value } from "@sinclair/typebox/value";
import { Client } from "@modelcontextprotocol/sdk/client";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { BookDetailsSchema, McpToolResponseSchemas } from "@agichat/contracts";
import { BooksService } from "../src/books.service";
import { createBooksMcpHandler } from "../src/mcp.server";

const networkFetch = globalThis.fetch;
globalThis.fetch = (async () => { throw new Error("Las pruebas MCP no pueden acceder a la red."); }) as unknown as typeof fetch;
afterAll(() => { globalThis.fetch = networkFetch; });

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function textContent(result: object): string {
  if (!("content" in result) || !Array.isArray(result.content)) return "";
  const first = result.content[0];
  return typeof first === "object" && first !== null && "type" in first && first.type === "text" && "text" in first && typeof first.text === "string" ? first.text : "";
}

const volume = {
  id: "zyTCAlFPjgYC",
  volumeInfo: {
    title: "The Matrix and Philosophy",
    authors: ["William Irwin"],
    description: "Descripción de Google Books.",
  },
};

function fakeFetch(input: RequestInfo | URL): Promise<Response> {
  const url = String(input);
  return Promise.resolve(url.includes("zyTCAlFPjgYC") ? jsonResponse(volume) : jsonResponse({ items: [volume] }));
}

describe("BooksService", () => {
  test("mapea búsqueda y detalles contra los schemas del contrato", async () => {
    const urls: string[] = [];
    const service = new BooksService({ fetchImpl: async (input) => { urls.push(String(input)); return fakeFetch(input); } });
    const search = await service.searchBooks("Matrix", "Irwin");
    expect(Value.Check(McpToolResponseSchemas.books.search_books, search)).toBe(true);
    const details = await service.getBookDetails("zyTCAlFPjgYC");
    expect(Value.Check(BookDetailsSchema, details)).toBe(true);
    expect(details).toEqual({
      volumeId: "zyTCAlFPjgYC",
      title: "The Matrix and Philosophy",
      authors: ["William Irwin"],
      description: "Descripción de Google Books.",
    });
    expect(urls[1]).toContain("https://www.googleapis.com/books/v1/volumes/zyTCAlFPjgYC");
    expect(urls[1]).not.toContain("infoLink");
  });

  test("explicita campos opcionales ausentes sin inventar valores", async () => {
    const service = new BooksService({ fetchImpl: async () => jsonResponse({ items: [{ id: "missing", volumeInfo: { title: "Sin metadatos" } }] }) });
    const result = await service.searchBooks("Sin metadatos");
    expect(result).toEqual({ results: [{ volumeId: "missing", title: "Sin metadatos", authors: [], description: "" }] });
  });

  test("devuelve vacío cuando no hay resultados y valida entradas", async () => {
    const service = new BooksService({ fetchImpl: async () => jsonResponse({ items: [] }) });
    expect(await service.searchBooks("unknown")).toEqual({ results: [] });
    await expect(service.searchBooks(" ")).rejects.toThrow();
    await expect(service.searchBooks("x".repeat(201))).rejects.toThrow();
    await expect(service.getBookDetails("bad/id")).rejects.toThrow();
  });

  test("mapea rate limit y upstream sin filtrar detalles", async () => {
    const rateLimited = new BooksService({ fetchImpl: async () => jsonResponse({ secret: "hidden" }, 429) });
    await expect(rateLimited.searchBooks("Matrix")).rejects.toMatchObject({ code: "RATE_LIMITED" });
    const upstream = new BooksService({ fetchImpl: async () => jsonResponse({ secret: "hidden" }, 500) });
    await expect(upstream.searchBooks("Matrix")).rejects.toMatchObject({ code: "UPSTREAM_ERROR" });
  });
});

describe("books-mcp Streamable HTTP", () => {
  test("publica las dos herramientas mediante Streamable HTTP", async () => {
    const handler = createBooksMcpHandler(new BooksService({ fetchImpl: fakeFetch }));
    const transport = new StreamableHTTPClientTransport(new URL("http://books.test/mcp"), { fetch: (input, init) => handler(new Request(input, init)) });
    const client = new Client({ name: "test-client", version: "1.0.0" });
    await client.connect(transport);
    const tools = await client.listTools();
    expect(tools.tools.map((tool) => tool.name)).toEqual(["search_books", "get_book_details"]);
    const result = await client.callTool({ name: "get_book_details", arguments: { volumeId: "zyTCAlFPjgYC" } });
    expect(result.isError).not.toBe(true);
    expect(JSON.parse(textContent(result))).toMatchObject({ volumeId: "zyTCAlFPjgYC" });
    await client.close();
  });

  test("devuelve error estructurado para un proveedor caído", async () => {
    const handler = createBooksMcpHandler(new BooksService({ fetchImpl: async () => jsonResponse({}, 500) }));
    const transport = new StreamableHTTPClientTransport(new URL("http://books.test/mcp"), { fetch: (input, init) => handler(new Request(input, init)) });
    const client = new Client({ name: "test-client", version: "1.0.0" });
    await client.connect(transport);
    const result = await client.callTool({ name: "search_books", arguments: { title: "Matrix" } });
    expect(result.isError).toBe(true);
    expect(textContent(result)).toContain("UPSTREAM_ERROR");
    await client.close();
  });
});
