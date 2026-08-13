export interface AGIChatConfig {
  containerId: string;
  apiUrl: string;
  conversationId?: string;
  theme?: {
    primaryColor?: string;
    fontFamily?: string;
  };
}

declare global {
  interface Window {
    AGIChat: {
      init: (config: AGIChatConfig) => void;
      destroy: () => void;
    };
  }
}

export function init(_config: AGIChatConfig): void {
  throw new Error("AGIChat.init is not implemented yet");
}

export function destroy(): void {
  throw new Error("AGIChat.destroy is not implemented yet");
}
