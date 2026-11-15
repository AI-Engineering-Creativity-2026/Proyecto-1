import type { Ref } from "vue";
import { onScopeDispose } from "vue";

import type { UiAction } from "@agichat/contracts";

import type { ChatState } from "../types/chat";
import { createChatSession } from "../services/chatSession";

export interface UseChatOptions {
  conversationId: string;
  apiUrl: string;
  clientTimeoutMs?: number;
  onAction?: (action: UiAction["action"]) => void;
}

export interface UseChatReturn {
  state: Readonly<Ref<ChatState>>;
  sendMessage: (text: string) => void;
  retryLastMessage: () => void;
  clearError: () => void;
}

export function useChat(options: UseChatOptions): UseChatReturn {
  const session = createChatSession(
    {
      conversationId: options.conversationId,
      apiUrl: options.apiUrl,
      onAction: options.onAction,
    },
    { responseTimeoutMs: options.clientTimeoutMs ?? 45_000 },
  );

  onScopeDispose(session.dispose);

  return {
    state: session.state,
    sendMessage: session.sendMessage,
    retryLastMessage: session.retryLastMessage,
    clearError: session.clearError,
  };
}
