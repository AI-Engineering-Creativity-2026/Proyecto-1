import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AGIChatConfig } from "../index";

const sdk = vi.hoisted(() => ({
  init: vi.fn<(config: AGIChatConfig) => void>(),
  destroy: vi.fn<() => void>(),
}));

vi.mock("../index", () => {
  window.AGIChat = sdk;
  return {};
});

import { mountDemo } from "../demo";

const demoHtml = readFileSync("demo.html", "utf8");

afterEach(() => {
  document.body.innerHTML = "";
  vi.clearAllMocks();
});

describe("embedded widget demo", () => {
  it("loads the SDK bootstrap into a host page container", () => {
    expect(demoHtml).toContain('<html lang="en">');
    expect(demoHtml).toContain('id="agichat-demo-widget"');
    expect(demoHtml).toContain('src="/src/demo.ts"');
  });

  it("initializes the public SDK in its demo container with the selected endpoint", () => {
    const container = document.createElement("div");
    container.id = "agichat-demo-widget";
    document.body.appendChild(container);

    mountDemo("ws://mock.example/ws");

    expect(sdk.init).toHaveBeenCalledWith({
      containerId: "agichat-demo-widget",
      apiUrl: "ws://mock.example/ws",
      conversationId: "agichat-demo",
    });
  });

  it("does not initialize when the host page has no widget container", () => {
    mountDemo("ws://mock.example/ws");

    expect(sdk.init).not.toHaveBeenCalled();
  });
});
