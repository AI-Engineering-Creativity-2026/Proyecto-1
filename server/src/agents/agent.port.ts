import type { IncomingMessage, OutgoingMessage } from "@agichat/contracts";

export interface ConversationContext {
  conversationId: string;
  history: readonly IncomingMessage[];
}

export interface AgentPort {
  respond(
    message: OutgoingMessage,
    context: ConversationContext,
  ): Promise<IncomingMessage[]>;
}
