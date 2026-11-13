import type { IncomingMessage, OutgoingMessage } from "@agichat/contracts";
import { MockAgent, type AgentPort } from "../agents";

export type LatencyProvider = () => number;

export function randomLatency(): number {
  return Math.floor(Math.random() * 1501) + 500;
}

export interface ChatHandlerOptions {
  agentTimeoutMs?: number;
}

export interface ChatHandlerResult {
  onOutgoingMessage: (message: OutgoingMessage) => Promise<IncomingMessage[]>;
}

function timeoutEvent(conversationId: string): IncomingMessage {
  return {
    type: "error",
    conversationId,
    error: {
      code: "AGENT_TIMEOUT",
      message: "El agente tardó demasiado en responder. Intenta de nuevo.",
    },
    timestamp: new Date().toISOString(),
  };
}

export function createChatHandler(
  agent: AgentPort = new MockAgent(),
  options: ChatHandlerOptions = {},
): ChatHandlerResult {
  const agentTimeoutMs = options.agentTimeoutMs ?? 30_000;
  const history: IncomingMessage[] = [];

  return {
    onOutgoingMessage: async (message) => {
      let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
      const timeoutResponse = new Promise<IncomingMessage[]>((resolve) => {
        timeoutHandle = setTimeout(
          () => resolve([timeoutEvent(message.conversationId)]),
          agentTimeoutMs,
        );
      });

      const response = await Promise.race([
        agent.respond(message, {
          conversationId: message.conversationId,
          history,
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
