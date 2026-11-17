import type { IncomingMessage, OutgoingMessage } from "@agichat/contracts";
import type { AgentPort } from "../agents";
import { ConversationStore, type ConversationStoreOptions } from "./conversation-store";

export type LatencyProvider = () => number;

export function randomLatency(): number {
  return Math.floor(Math.random() * 1501) + 500;
}

export interface ChatHandlerOptions {
  agentTimeoutMs?: number;
  now?: () => Date;
  store?: ConversationStore;
  storeOptions?: ConversationStoreOptions;
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
  const store = options.store ?? new ConversationStore(options.storeOptions);
  const historyByConversation = new Map<string, IncomingMessage[]>();

  return {
    onOutgoingMessage: async (message) => {
      const history = historyByConversation.get(message.conversationId) ?? [];
      const turns = store.getTurns(message.conversationId);
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
          turns,
        }).catch((error: unknown) => {
          const code = errorCode(error);
          return [errorEvent(message.conversationId, code, errorMessage(code), now)];
        }),
        timeoutResponse,
      ]).finally(() => {
        if (timeoutHandle !== undefined) clearTimeout(timeoutHandle);
      });

      const agentMessages = response.filter((item) => item.type === "agent_message");
      if (agentMessages.length > 0) {
        store.appendTurn(message.conversationId, { role: "user", content: message.content });
        for (const msg of agentMessages) {
          store.appendTurn(message.conversationId, { role: "agent", content: msg.content });
        }
        const nextHistory = [...history, ...agentMessages].slice(-12);
        historyByConversation.set(message.conversationId, nextHistory);
      }
      return response;
    },
  };
}
