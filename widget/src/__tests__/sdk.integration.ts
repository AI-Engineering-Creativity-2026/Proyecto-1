import { describe, expect, it, vi } from "vitest";

import { applyTheme, createConversationId, init } from "../index";

describe("AGIChat SDK helpers", () => {
  it("applies theme options as custom element CSS variables", () => {
    const element = document.createElement("div");

    applyTheme(element, {
      primaryColor: "#123456",
      fontFamily: "Arial",
    });

    expect(element.style.getPropertyValue("--agichat-primary-color")).toBe("#123456");
    expect(element.style.getPropertyValue("--agichat-font-family")).toBe("Arial");
  });

  it("generates an id only when the client does not provide one", () => {
    expect(createConversationId("provided")).toBe("provided");
    expect(createConversationId()).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("mounts the custom element in the configured container", () => {
    const container = document.createElement("div");
    container.id = "widget-container";
    document.body.appendChild(container);
    const appendChild = vi.spyOn(container, "appendChild").mockImplementation(
      (node) => node,
    );

    init({
      containerId: container.id,
      apiUrl: "ws://localhost:3000/ws",
      conversationId: "conversation-test",
    });

    expect(appendChild).toHaveBeenCalledOnce();
    expect((appendChild.mock.calls[0]?.[0] as HTMLElement).tagName.toLowerCase()).toBe(
      "agichat-widget",
    );
  });
});
