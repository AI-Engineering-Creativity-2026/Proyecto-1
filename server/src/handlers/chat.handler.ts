import type { IncomingMessage, OutgoingMessage } from "../schemas/chat.schema";

export interface ChatHandlerResult {
  onOutgoingMessage: (message: OutgoingMessage) => IncomingMessage[];
}

export function createChatHandler(): ChatHandlerResult {
  return {
    onOutgoingMessage: () => [],
  };
}
