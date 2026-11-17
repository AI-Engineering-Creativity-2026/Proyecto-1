import { defineCustomElement } from "vue";

import App from "./App.vue";

export interface AGIChatConfig {
  containerId: string;
  apiUrl: string;
  conversationId?: string;
  assistantName?: string;
  mode?: "floating" | "docked";
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

export function createConversationId(explicitId?: string): string {
  return explicitId ?? crypto.randomUUID();
}

export function applyTheme(element: HTMLElement, theme: AGIChatConfig["theme"]): void {
  element.style.setProperty("--agichat-primary-color", theme?.primaryColor ?? "#ff4a1c");
  if (theme?.fontFamily) element.style.setProperty("--agichat-font-family", theme.fontFamily);
}

export function init(config: AGIChatConfig): void {
  const container = document.getElementById(config.containerId);

  if (!container) {
    throw new Error(`AGIChat container not found: ${config.containerId}`);
  }

  ensureWidgetDefined();
  destroy();

  const element = document.createElement(widgetTagName);
  element.setAttribute("api-url", config.apiUrl);
  element.setAttribute("conversation-id", createConversationId(config.conversationId));
  element.setAttribute("assistant-name", config.assistantName?.trim() || "Selma");
  element.setAttribute("mode", config.mode === "docked" ? "docked" : "floating");
  applyTheme(element, config.theme);
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
