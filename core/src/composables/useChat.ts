import type { Ref } from "vue";

import type { ChatState } from "../types/chat";

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
  throw new Error("useChat is not implemented yet");
}
