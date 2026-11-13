import { describe, expect, test } from "bun:test";
import {
  McpProviderError,
  McpRequestCache,
  MemoryCacheStore,
  readMcpCacheConfig,
} from "../src/index";

describe("McpRequestCache", () => {
  test("usa el valor almacenado hasta que vence el TTL", async () => {
    let now = 1_000;
    const cache = new McpRequestCache({ clock: () => now, ttlMs: 100 });
    let calls = 0;

    expect(await cache.getOrFetch("tmdb", "movie:1", async () => ++calls)).toBe(1);
    now = 1_099;
    expect(await cache.getOrFetch("tmdb", "movie:1", async () => ++calls)).toBe(1);
    now = 1_100;
    expect(await cache.getOrFetch("tmdb", "movie:1", async () => ++calls)).toBe(2);
    expect(calls).toBe(2);
  });

  test("aplica el límite de entradas expulsando la más antigua", async () => {
    const cache = new McpRequestCache({ maxEntries: 2 });
    await cache.getOrFetch("tmdb", "a", async () => "a");
    await cache.getOrFetch("tmdb", "b", async () => "b");
    await cache.getOrFetch("tmdb", "c", async () => "c");

    expect(cache.cacheSize).toBe(2);
    let calls = 0;
    expect(await cache.getOrFetch("tmdb", "a", async () => ++calls)).toBe(1);
  });

  test("separa el presupuesto por proveedor y no consume con aciertos de caché", async () => {
    const cache = new McpRequestCache({ dailyLimits: { tmdb: 1, google_books: 1 } });

    await cache.getOrFetch("tmdb", "same", async () => "cached");
    await cache.getOrFetch("tmdb", "same", async () => "should not run");
    await cache.getOrFetch("google_books", "same", async () => "book");

    expect(cache.getBudgetUsage("tmdb")).toBe(1);
    expect(cache.getBudgetUsage("google_books")).toBe(1);
  });

  test("falla antes del proveedor cuando se agota el presupuesto", async () => {
    const cache = new McpRequestCache({ dailyLimits: { tmdb: 1 } });
    let calls = 0;
    await cache.getOrFetch("tmdb", "first", async () => ++calls);

    await expect(
      cache.getOrFetch("tmdb", "second", async () => ++calls),
    ).rejects.toMatchObject({ code: "RATE_LIMITED" });
    expect(calls).toBe(1);
  });

  test("reinicia el presupuesto al cambiar el día UTC", async () => {
    let now = Date.parse("2026-01-01T23:59:59.000Z");
    const cache = new McpRequestCache({ clock: () => now, dailyLimits: { tmdb: 1 } });
    await cache.getOrFetch("tmdb", "day-one", async () => "one");
    now += 2_000;

    await expect(cache.getOrFetch("tmdb", "day-two", async () => "two")).resolves.toBe("two");
    expect(cache.getBudgetUsage("tmdb")).toBe(1);
  });

  test("deduplica solicitudes idénticas en vuelo", async () => {
    const cache = new McpRequestCache({ dailyLimits: { tmdb: 1 } });
    let calls = 0;
    let resolve: ((value: string) => void) | undefined;
    const pending = new Promise<string>((res) => {
      resolve = res;
    });
    const first = cache.getOrFetch("tmdb", "same", async () => {
      calls += 1;
      return pending;
    });
    const second = cache.getOrFetch("tmdb", "same", async () => "wrong");

    resolve?.("result");
    await expect(Promise.all([first, second])).resolves.toEqual(["result", "result"]);
    expect(calls).toBe(1);
    expect(cache.getBudgetUsage("tmdb")).toBe(1);
  });

  test("mapea un fallo del proveedor y no almacena el resultado", async () => {
    const cache = new McpRequestCache();

    await expect(
      cache.getOrFetch("tmdb", "failure", async () => {
        throw new Error("detalle interno que no debe propagarse");
      }),
    ).rejects.toEqual(
      expect.objectContaining({
        code: "UPSTREAM_ERROR",
        message: "El proveedor externo no está disponible.",
      }),
    );
  });
});

describe("MemoryCacheStore", () => {
  test("permite inyectar un almacenamiento compatible y un reloj", () => {
    let now = 10;
    const store = new MemoryCacheStore<string, string>(() => now, 1);
    store.set("key", "value", 20);
    expect(store.get("key")).toBe("value");
    now = 20;
    expect(store.get("key")).toBeUndefined();
  });
});

describe("readMcpCacheConfig", () => {
  test("usa defaults seguros y permite configurar TTL, entradas y proveedores", () => {
    expect(readMcpCacheConfig({})).toEqual({
      ttlMs: 300_000,
      maxEntries: 500,
      dailyLimits: { tmdb: 900, google_books: 900 },
    });
    expect(
      readMcpCacheConfig({
        MCP_CACHE_TTL_MS: "1000",
        MCP_CACHE_MAX_ENTRIES: "10",
        TMDB_DAILY_REQUEST_LIMIT: "12",
        GOOGLE_BOOKS_DAILY_REQUEST_LIMIT: "13",
      }),
    ).toEqual({
      ttlMs: 1000,
      maxEntries: 10,
      dailyLimits: { tmdb: 12, google_books: 13 },
    });
  });

  test("rechaza límites diarios mayores al máximo contractual", () => {
    expect(() => readMcpCacheConfig({ TMDB_DAILY_REQUEST_LIMIT: "1001" })).toThrow();
  });
});

test("expone códigos de error del contrato sin filtrar detalles upstream", () => {
  const error = new McpProviderError("UPSTREAM_ERROR", "Mensaje seguro.");
  expect(error.code).toBe("UPSTREAM_ERROR");
  expect(error.message).toBe("Mensaje seguro.");
});
