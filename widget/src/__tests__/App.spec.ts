import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";

describe("App", () => {
  it("contains the AGIChat shell copy", () => {
    const source = readFileSync(
      new URL("../App.vue", import.meta.url),
      "utf8"
    );

    expect(source).toContain("AGIChat UI");
  });
});
