import { describe, expect, it } from "vitest";

import { renderMarkdown } from "../utils/markdown";

describe("renderMarkdown", () => {
  it("renders markdown formatting", () => {
    const html = renderMarkdown("**Answer**\n\n- One\n- Two");

    expect(html).toContain("<strong>Answer</strong>");
    expect(html).toContain("<ul>");
  });

  it("sanitizes unsafe HTML from agent content", () => {
    const html = renderMarkdown(
      '<img src="x" onerror="alert(1)">[safe](https://example.com)',
    );

    expect(html).not.toContain("onerror");
    expect(html).toContain('<img src="x">');
    expect(html).toContain('href="https://example.com"');
  });
});
