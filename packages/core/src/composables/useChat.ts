import type { Ref } from "vue";
import { onScopeDispose } from "vue";

import type { ChatState } from "../types/chat";
import { createChatSession } from "../services/chatSession";

export interface UseChatOptions {
  conversationId: string;
  apiUrl: string;
}

export interface UseChatReturn {
  state: Readonly<Ref<ChatState>>;
  sendMessage: (text: string) => void;
  retryLastMessage: () => void;
  clearError: () => void;
}

export function useChat(_options: UseChatOptions): UseChatReturn {
  const session = createChatSession(_options);

  onScopeDispose(session.dispose);

  return {
    state: session.state,
    sendMessage: session.sendMessage,
    retryLastMessage: session.retryLastMessage,
    clearError: session.clearError,
  };
}
