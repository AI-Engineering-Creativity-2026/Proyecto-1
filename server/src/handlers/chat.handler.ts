import type { IncomingMessage, OutgoingMessage } from "@agichat/contracts";
import type { AgentPort } from "../agents";

export type LatencyProvider = () => number;

export function randomLatency(): number {
  return Math.floor(Math.random() * 1501) + 500;
}

export interface ChatHandlerOptions {
  agentTimeoutMs?: number;
  now?: () => Date;
}

export interface ChatHandlerResult {
  onOutgoingMessage: (message: OutgoingMessage) => Promise<IncomingMessage[]>;
}

function errorEvent(
  conversationId: string,
  code: "AGENT_TIMEOUT" | "UPSTREAM_ERROR" | "RATE_LIMITED" | "AGENT_ERROR",
  message: string,
  now: () => Date,
): IncomingMessage {
  return {
    type: "error",
    conversationId,
    error: {
      code,
      message,
    },
    timestamp: now().toISOString(),
  };
}

function errorCode(error: unknown): "UPSTREAM_ERROR" | "RATE_LIMITED" | "AGENT_ERROR" {
  if (typeof error === "object" && error !== null && "code" in error) {
    if (error.code === "RATE_LIMITED" || error.code === "UPSTREAM_ERROR") return error.code;
  }
  return "AGENT_ERROR";
}

function errorMessage(code: "UPSTREAM_ERROR" | "RATE_LIMITED" | "AGENT_ERROR"): string {
  if (code === "RATE_LIMITED") return "Un servicio alcanzó su límite de solicitudes. Intenta más tarde.";
  if (code === "UPSTREAM_ERROR") return "Un servicio externo no está disponible. Intenta de nuevo.";
  return "No se pudo procesar tu solicitud. Intenta de nuevo.";
}

export function createChatHandler(
  agent: AgentPort,
  options: ChatHandlerOptions = {},
): ChatHandlerResult {
  const agentTimeoutMs = options.agentTimeoutMs ?? 30_000;
  const now = options.now ?? (() => new Date());
  const history: IncomingMessage[] = [];

  return {
    onOutgoingMessage: async (message) => {
      let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
      const timeoutResponse = new Promise<IncomingMessage[]>((resolve) => {
        timeoutHandle = setTimeout(
          () => resolve([errorEvent(
            message.conversationId,
            "AGENT_TIMEOUT",
            "El agente tardó demasiado en responder. Intenta de nuevo.",
            now,
          )]),
          agentTimeoutMs,
        );
      });

      const response = await Promise.race([
        agent.respond(message, {
          conversationId: message.conversationId,
          history,
        }).catch((error: unknown) => {
          const code = errorCode(error);
          return [errorEvent(message.conversationId, code, errorMessage(code), now)];
        }),
        timeoutResponse,
      ]).finally(() => {
        if (timeoutHandle !== undefined) clearTimeout(timeoutHandle);
      });

      history.push(...response);
      return response;
    },
  };
}
