import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";

describe("App", () => {
  it("offers controls for every visual state", () => {
    const source = readFileSync(
      new URL("../App.vue", import.meta.url),
      "utf8"
    );

    expect(source).toContain('{ label: "Conversation", value: "conversation" }');
    expect(source).toContain('{ label: "Empty", value: "empty" }');
    expect(source).toContain('{ label: "Loading", value: "loading" }');
    expect(source).toContain('{ label: "Error", value: "error" }');
  });

  it("renders the chat panel and launcher", () => {
    const source = readFileSync(
      new URL("../App.vue", import.meta.url),
      "utf8"
    );

    expect(source).toContain("<ChatPanel");
    expect(source).toContain("chat-launcher");
  });
});
