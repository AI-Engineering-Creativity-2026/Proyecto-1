import type { ErrorCode } from "@agichat/contracts";

export type Provider = "tmdb" | "google_books";
export type ProviderErrorCode = Extract<ErrorCode, "RATE_LIMITED" | "UPSTREAM_ERROR">;
export type Clock = () => number;

export const DEFAULT_CACHE_TTL_MS = 300_000;
export const DEFAULT_CACHE_MAX_ENTRIES = 500;
export const DEFAULT_DAILY_REQUEST_LIMIT = 900;

export interface CacheStore<K, V> {
  get(key: K): V | undefined;
  set(key: K, value: V, expiresAt: number): void;
  delete(key: K): void;
  clear(): void;
  get size(): number;
}

interface CacheEntry<V> {
  value: V;
  expiresAt: number;
}

export class MemoryCacheStore<K, V> implements CacheStore<K, V> {
  private readonly entries = new Map<K, CacheEntry<V>>();

  public constructor(
    private readonly clock: Clock = Date.now,
    private readonly maxEntries = DEFAULT_CACHE_MAX_ENTRIES,
  ) {
    if (!Number.isInteger(maxEntries) || maxEntries < 1) {
      throw new RangeError("El límite de entradas de caché debe ser positivo.");
    }
  }

  public get(key: K): V | undefined {
    const entry = this.entries.get(key);
    if (entry === undefined) return undefined;

    if (entry.expiresAt <= this.clock()) {
      this.entries.delete(key);
      return undefined;
    }

    return entry.value;
  }

  public set(key: K, value: V, expiresAt: number): void {
    this.entries.delete(key);
    this.entries.set(key, { value, expiresAt });

    while (this.entries.size > this.maxEntries) {
      const oldestKey = this.entries.keys().next().value as K | undefined;
      if (oldestKey === undefined) break;
      this.entries.delete(oldestKey);
    }
  }

  public delete(key: K): void {
    this.entries.delete(key);
  }

  public clear(): void {
    this.entries.clear();
  }

  public get size(): number {
    return this.entries.size;
  }
}

export interface BudgetStore {
  getUsage(provider: Provider, day: string): number;
  increment(provider: Provider, day: string): number;
  clear(): void;
}

export class MemoryBudgetStore implements BudgetStore {
  private readonly usage = new Map<string, number>();

  public getUsage(provider: Provider, day: string): number {
    return this.usage.get(this.key(provider, day)) ?? 0;
  }

  public increment(provider: Provider, day: string): number {
    const key = this.key(provider, day);
    const next = this.getUsage(provider, day) + 1;
    this.usage.set(key, next);
    return next;
  }

  public clear(): void {
    this.usage.clear();
  }

  private key(provider: Provider, day: string): string {
    return `${provider}:${day}`;
  }
}

export class McpProviderError extends Error {
  public constructor(
    public readonly code: ProviderErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "McpProviderError";
  }
}

export interface DailyLimits {
  tmdb: number;
  google_books: number;
}

export interface McpCacheOptions {
  clock?: Clock;
  ttlMs?: number;
  maxEntries?: number;
  dailyLimits?: Partial<DailyLimits>;
  cacheStore?: CacheStore<string, unknown>;
  budgetStore?: BudgetStore;
}

export class McpRequestCache {
  private readonly clock: Clock;
  private readonly ttlMs: number;
  private readonly cache: CacheStore<string, unknown>;
  private readonly budget: BudgetStore;
  private readonly dailyLimits: DailyLimits;
  private readonly inFlight = new Map<string, Promise<unknown>>();

  public constructor(options: McpCacheOptions = {}) {
    this.clock = options.clock ?? Date.now;
    this.ttlMs = validatePositiveInteger(options.ttlMs ?? DEFAULT_CACHE_TTL_MS, "TTL");
    this.cache = options.cacheStore ?? new MemoryCacheStore(this.clock, options.maxEntries);
    this.budget = options.budgetStore ?? new MemoryBudgetStore();
    this.dailyLimits = {
      tmdb: validateDailyLimit(options.dailyLimits?.tmdb),
      google_books: validateDailyLimit(options.dailyLimits?.google_books),
    };
  }

  public async getOrFetch<T>(
    provider: Provider,
    key: string,
    fetcher: () => Promise<T>,
  ): Promise<T> {
    validateCacheKey(key);
    const scopedKey = `${provider}:${key}`;

    const cached = this.cache.get(scopedKey) as T | undefined;
    if (cached !== undefined) return cached;

    const current = this.inFlight.get(scopedKey);
    if (current !== undefined) return (await current) as T;

    const request = this.fetchAndCache(provider, scopedKey, fetcher);
    this.inFlight.set(scopedKey, request);

    try {
      return await request;
    } finally {
      this.inFlight.delete(scopedKey);
    }
  }

  public get cacheSize(): number {
    return this.cache.size;
  }

  public getBudgetUsage(provider: Provider): number {
    return this.budget.getUsage(provider, this.dayKey());
  }

  private async fetchAndCache<T>(
    provider: Provider,
    key: string,
    fetcher: () => Promise<T>,
  ): Promise<T> {
    this.consumeBudget(provider);

    try {
      const value = await fetcher();
      this.cache.set(key, value, this.clock() + this.ttlMs);
      return value;
    } catch (error) {
      if (error instanceof McpProviderError) throw error;
      throw new McpProviderError("UPSTREAM_ERROR", "El proveedor externo no está disponible.");
    }
  }

  private consumeBudget(provider: Provider): void {
    const day = this.dayKey();
    if (this.budget.getUsage(provider, day) >= this.dailyLimits[provider]) {
      throw new McpProviderError("RATE_LIMITED", "Se alcanzó el límite diario del proveedor.");
    }
    this.budget.increment(provider, day);
  }

  private dayKey(): string {
    return new Date(this.clock()).toISOString().slice(0, 10);
  }
}

export interface McpEnvironment {
  MCP_CACHE_TTL_MS?: string;
  MCP_CACHE_MAX_ENTRIES?: string;
  TMDB_DAILY_REQUEST_LIMIT?: string;
  GOOGLE_BOOKS_DAILY_REQUEST_LIMIT?: string;
}

export interface McpCacheConfig {
  ttlMs: number;
  maxEntries: number;
  dailyLimits: DailyLimits;
}

export function readMcpCacheConfig(environment: McpEnvironment = process.env): McpCacheConfig {
  return {
    ttlMs: parsePositiveInteger(environment.MCP_CACHE_TTL_MS, DEFAULT_CACHE_TTL_MS, "MCP_CACHE_TTL_MS"),
    maxEntries: parsePositiveInteger(
      environment.MCP_CACHE_MAX_ENTRIES,
      DEFAULT_CACHE_MAX_ENTRIES,
      "MCP_CACHE_MAX_ENTRIES",
    ),
    dailyLimits: {
      tmdb: parseDailyLimit(environment.TMDB_DAILY_REQUEST_LIMIT),
      google_books: parseDailyLimit(environment.GOOGLE_BOOKS_DAILY_REQUEST_LIMIT),
    },
  };
}

function validateCacheKey(key: string): void {
  if (key.length === 0 || key.length > 512) {
    throw new RangeError("La clave de caché debe tener entre 1 y 512 caracteres.");
  }
}

function validatePositiveInteger(value: number, name: string): number {
  if (!Number.isInteger(value) || value < 1) {
    throw new RangeError(`El ${name} debe ser un entero positivo.`);
  }
  return value;
}

function validateDailyLimit(value: number | undefined): number {
  const limit = value ?? DEFAULT_DAILY_REQUEST_LIMIT;
  if (!Number.isInteger(limit) || limit < 1 || limit > 1000) {
    throw new RangeError("El límite diario debe ser un entero entre 1 y 1000.");
  }
  return limit;
}

function parsePositiveInteger(value: string | undefined, fallback: number, name: string): number {
  if (value === undefined || value.trim() === "") return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new RangeError(`${name} debe ser un entero positivo.`);
  }
  return parsed;
}

function parseDailyLimit(value: string | undefined): number {
  return validateDailyLimit(
    value === undefined || value.trim() === "" ? undefined : Number(value),
  );
}
