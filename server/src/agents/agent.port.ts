import type { IncomingMessage, OutgoingMessage } from "@agichat/contracts";

export interface ConversationTurn {
  role: "user" | "agent";
  content: string;
}

export interface ConversationContext {
  conversationId: string;
  history: readonly IncomingMessage[];
  turns?: readonly ConversationTurn[];
}

export interface AgentPort {
  respond(
    message: OutgoingMessage,
    context: ConversationContext,
  ): Promise<IncomingMessage[]>;
}
