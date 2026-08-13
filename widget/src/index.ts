import { defineCustomElement } from "vue";

import App from "./App.vue";

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

const widgetTagName = "agichat-widget";
const WidgetElement = defineCustomElement(App);
let mountedElement: HTMLElement | null = null;

function ensureWidgetDefined(): void {
  if (!customElements.get(widgetTagName)) {
    customElements.define(widgetTagName, WidgetElement);
  }
}

function createConversationId(explicitId?: string): string {
  return explicitId ?? crypto.randomUUID();
}

export function init(config: AGIChatConfig): void {
  const container = document.getElementById(config.containerId);

  if (!container) {
    throw new Error(`AGIChat container not found: ${config.containerId}`);
  }

  ensureWidgetDefined();
  destroy();

  const element = document.createElement(widgetTagName);
  element.setAttribute("data-api-url", config.apiUrl);
  element.setAttribute("data-conversation-id", createConversationId(config.conversationId));
  container.appendChild(element);
  mountedElement = element;
}

export function destroy(): void {
  mountedElement?.remove();
  mountedElement = null;
}

if (typeof window !== "undefined") {
  window.AGIChat = { init, destroy };
}
