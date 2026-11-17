import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../index", () => ({
  init: vi.fn<() => void>(),
  destroy: vi.fn<() => void>(),
}));

import { mountDemo } from "../demo";

const demoHtml = readFileSync("demo.html", "utf8");

afterEach(() => {
  document.body.innerHTML = "";
  window.location.hash = "";
  vi.clearAllMocks();
});

describe("embedded widget demo", () => {
  it("loads the Spanish Selma landing/chat shell without forbidden placeholder copy", () => {
    expect(demoHtml).toContain('<html lang="es">');
    expect(demoHtml).toContain('id="agichat-demo-app"');
    expect(demoHtml).toContain('src="/src/demo.ts"');
    expect(demoHtml).not.toMatch(/mook|21\.04/i);
  });

  it("mounts the landing view in #agichat-demo-app with zero Mook or 21.04 in DOM", () => {
    const container = document.createElement("div");
    container.id = "agichat-demo-app";
    document.body.appendChild(container);

    mountDemo("ws://mock.example/ws");

    expect(container.textContent).toContain("Si te gustó la película, descubre el libro.");
    expect(container.textContent).not.toMatch(/mook|21\.04/i);
  });

  it("does not mount when the host page has no app container", () => {
    mountDemo("ws://mock.example/ws");

    expect(document.body.innerHTML).toBe("");
  });
});
