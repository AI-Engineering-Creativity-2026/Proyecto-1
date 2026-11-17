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
