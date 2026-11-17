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
    expect(demoHtml).toContain('<html lang="es">');
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
      assistantName: "Selma",
      mode: "docked",
      theme: {
        primaryColor: "#ff4a1c",
      },
    });
  });

  it("does not initialize when the host page has no widget container", () => {
    mountDemo("ws://mock.example/ws");

    expect(sdk.init).not.toHaveBeenCalled();
  });

  it("updates live time and animates ethereal figure on pointermove unless reduced motion is set", () => {
    const timeEl = document.createElement("time");
    timeEl.id = "mook-live-time";
    const container = document.createElement("div");
    container.id = "agichat-demo-widget";
    document.body.append(timeEl, container);

    const originalMatchMedia = window.matchMedia;
    const originalRaf = window.requestAnimationFrame;
    const rafCallbacks: FrameRequestCallback[] = [];
    window.requestAnimationFrame = vi.fn<(cb: FrameRequestCallback) => number>((cb) => {
      rafCallbacks.push(cb);
      return rafCallbacks.length;
    });
    window.matchMedia = vi.fn<(query: string) => MediaQueryList>((query) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn<() => void>(),
      removeListener: vi.fn<() => void>(),
      addEventListener: vi.fn<() => void>(),
      removeEventListener: vi.fn<() => void>(),
      dispatchEvent: vi.fn<() => boolean>(),
    })) as unknown as typeof window.matchMedia;

    try {
      mountDemo("ws://mock.example/ws");
      expect(timeEl.textContent).not.toBe("");

      window.dispatchEvent(new MouseEvent("pointermove", { clientX: 500, clientY: 300 }));
      expect(rafCallbacks.length).toBeGreaterThan(0);
      rafCallbacks.shift()?.(16);
      expect(document.documentElement.style.getPropertyValue("--mook-fig-x")).not.toBe("");

      document.dispatchEvent(new Event("visibilitychange"));
    } finally {
      window.matchMedia = originalMatchMedia;
      window.requestAnimationFrame = originalRaf;
    }
  });
});
