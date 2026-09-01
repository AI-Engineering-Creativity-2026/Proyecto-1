import type { IncomingMessage, OutgoingMessage } from "../schemas/chat.schema";

export interface ChatHandlerResult {
  onOutgoingMessage: (message: OutgoingMessage) => IncomingMessage[];
}

export function createChatHandler(): ChatHandlerResult {
  return {
    onOutgoingMessage: (message) => {
      const timestamp = new Date().toISOString();

      if (message.content.includes("__force_error__")) {
        return [
          {
            type: "error",
            conversationId: message.conversationId,
            error: {
              code: "FORCED_ERROR",
              message: "No se pudo procesar el mensaje. Intenta de nuevo.",
            },
            timestamp,
          },
        ];
      }

      return [
        {
          type: "agent_typing",
          conversationId: message.conversationId,
          timestamp,
        },
        {
          type: "agent_message",
          conversationId: message.conversationId,
          content: `Recibí tu mensaje: **${message.content}**`,
          timestamp,
        },
      ];
    },
  };
}
