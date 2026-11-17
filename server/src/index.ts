import { Elysia } from "elysia";
import { Value } from "@sinclair/typebox/value";
import {
  isIncomingMessage,
  OutgoingMessageSchema,
  type OutgoingMessage,
} from "@agichat/contracts";
import {
  createConfiguredServerAgent,
  resolveAgentMode,
  type AgentEnvironment,
  type AgentPort,
} from "./agents";
import { createChatHandler, randomLatency } from "./handlers";

interface AppOptions {
  latency?: () => number;
  allowedOrigins?: string[];
  agent?: AgentPort;
  agentTimeoutMs?: number;
  environment?: AgentEnvironment;
}

interface ProviderQuota {
  used: number;
  limit: number;
  usedPct: number;
  tpmLimit?: number;
  tpmUsedPct?: number;
}

function mcpHealthUrl(mcpUrl: string | undefined, fallback: string): string {
  const base = mcpUrl?.trim() || fallback;
  return base.replace(/\/mcp\/?$/, "/health");
}

async function fetchMcpQuota(url: string): Promise<ProviderQuota | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(2_500) });
    if (!res.ok) return null;
    const data = (await res.json()) as { quota?: ProviderQuota };
    return data.quota ?? null;
  } catch {
    return null;
  }
}

let cachedGroqQuota: { value: ProviderQuota | null; expiresAt: number } | undefined;

async function fetchGroqQuota(env: AgentEnvironment): Promise<ProviderQuota | null> {
  const apiKey = env.GROQ_API_KEY?.trim();
  if (!apiKey || resolveAgentMode(env) !== "groq") return null;
  if (cachedGroqQuota && cachedGroqQuota.expiresAt > Date.now()) {
    return cachedGroqQuota.value;
  }
  try {
    const baseUrl = (env.GROQ_BASE_URL?.trim() || "https://api.groq.com/openai/v1").replace(/\/$/, "");
    const model = env.GROQ_MODEL?.trim() || "openai/gpt-oss-20b";
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ model, messages: [{ role: "user", content: "ok" }], max_tokens: 1 }),
      signal: AbortSignal.timeout(4_000),
    });
    const reqLim = Number(res.headers.get("x-ratelimit-limit-requests") || 0);
    const reqRem = Number(res.headers.get("x-ratelimit-remaining-requests") || 0);
    const tokLim = Number(res.headers.get("x-ratelimit-limit-tokens") || 0);
    const tokRem = Number(res.headers.get("x-ratelimit-remaining-tokens") || 0);
    const used = Math.max(0, reqLim - reqRem);
    const usedPct = reqLim > 0 ? Number(((used / reqLim) * 100).toFixed(2)) : 0;
    const tpmUsedPct = tokLim > 0 ? Number((((tokLim - tokRem) / tokLim) * 100).toFixed(2)) : 0;
    const value: ProviderQuota | null = reqLim > 0
      ? { used, limit: reqLim, usedPct, tpmLimit: tokLim, tpmUsedPct }
      : null;
    cachedGroqQuota = { value, expiresAt: Date.now() + 60_000 };
    return value;
  } catch {
    return null;
  }
}

function invalidMessageError(conversationId: string) {
  return {
    type: "error" as const,
    conversationId,
    error: {
      code: "INVALID_MESSAGE" as const,
      message: "La solicitud es inválida o supera el límite de 2000 caracteres.",
    },
    timestamp: new Date().toISOString(),
  };
}

function parseIncomingPayload(raw: unknown): { parsed: unknown; conversationId: string } | null {
  let parsed: unknown = raw;
  if (typeof raw === "string") {
    try {
      parsed = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  const conversationId =
    typeof parsed === "object" &&
    parsed !== null &&
    "conversationId" in parsed &&
    typeof (parsed as { conversationId?: unknown }).conversationId === "string" &&
    (parsed as { conversationId: string }).conversationId.trim().length > 0
      ? (parsed as { conversationId: string }).conversationId
      : "unknown";
  return { parsed, conversationId };
}

export function createApp(options: AppOptions = {}) {
  const environment = options.environment ?? process.env;
  const agent = options.agent ?? createConfiguredServerAgent(environment);
  const handler = createChatHandler(agent, {
    agentTimeoutMs:
      options.agentTimeoutMs ?? Number(process.env.AGENT_TIMEOUT_MS ?? 30_000),
  });
  const latency = options.latency ?? randomLatency;

  return new Elysia()
    .get("/health", () => ({
      service: "agichat-mock-api",
      status: "ok",
    }))
    .get("/api/quota", async ({ request, set }) => {
      const origin = request.headers.get("origin");
      const allowed = options.allowedOrigins ?? [];
      if (origin && (allowed.length === 0 || allowed.includes(origin))) {
        set.headers["access-control-allow-origin"] = origin;
      } else {
        set.headers["access-control-allow-origin"] = "*";
      }
      const [groq, tmdb, google_books] = await Promise.all([
        fetchGroqQuota(environment),
        fetchMcpQuota(mcpHealthUrl(process.env.TMDB_MCP_URL, "http://localhost:3101/mcp")),
        fetchMcpQuota(mcpHealthUrl(process.env.BOOKS_MCP_URL, "http://localhost:3102/mcp")),
      ]);
      return { groq, tmdb, google_books };
    })
    .ws("/ws", {
      beforeHandle({ request, set }) {
        const allowedOrigins = options.allowedOrigins ?? [];
        const origin = request.headers.get("origin");
        if (allowedOrigins.length > 0 && (!origin || !allowedOrigins.includes(origin))) {
          set.status = 403;
          return "Origin not allowed";
        }
      },
      async message(ws, rawMessage) {
        const extracted = parseIncomingPayload(rawMessage);
        if (!extracted || !Value.Check(OutgoingMessageSchema, extracted.parsed)) {
          ws.send(JSON.stringify(invalidMessageError(extracted?.conversationId ?? "unknown")));
          return;
        }

        const outgoing = extracted.parsed as OutgoingMessage;
        const responses = await handler.onOutgoingMessage(outgoing);
        const sendResponse = (response: unknown) => {
          if (!isIncomingMessage(response)) {
            console.error("Invalid outgoing WebSocket message", response);
            ws.send(JSON.stringify(invalidMessageError(outgoing.conversationId)));
            return;
          }
          ws.send(JSON.stringify(response));
        };

        if (responses.length === 0) return;
        sendResponse(responses[0]);

        const remaining = responses.slice(1);
        if (remaining.length > 0) {
          setTimeout(() => {
            for (const response of remaining) {
              sendResponse(response);
            }
          }, latency());
        }
      },
    })
    .get("/", () => Bun.file(new URL("../public/index.html", import.meta.url)))
    .get("/*", ({ request, set }) => {
      const pathname = new URL(request.url).pathname;
      const relativePath = pathname.slice(1);

      if (!relativePath || relativePath.includes("..")) {
        set.status = 404;
        return "Not found";
      }

      return Bun.file(new URL(`../public/${relativePath}`, import.meta.url));
    });
}

if (import.meta.main) {
  const port = Number(process.env.PORT ?? 3000);
  const agentMode = resolveAgentMode(process.env);
  const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  const app = createApp({
    allowedOrigins,
    agentTimeoutMs: Number(process.env.AGENT_TIMEOUT_MS ?? 30_000),
  }).listen(port);

  console.log(`Agente: ${agentMode}`);
  console.log(
    `AGIChat API listening at ${app.server?.hostname}:${app.server?.port}`
  );
}
