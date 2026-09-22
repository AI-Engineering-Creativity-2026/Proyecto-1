import { describe, expect, it } from "bun:test";

import { readFixture } from "../../../test/helpers/read-fixture";

const panelSource = readFixture(
  new URL("../components/ChatPanel.vue", import.meta.url),
);

describe("ChatPanel visual states", () => {
  it("renders the empty state with actionable suggestions", () => {
    expect(panelSource).toContain("!hasMessages && state.status !== 'error'");
    expect(panelSource).toContain("const suggestions");
    expect(panelSource).toContain("<SuggestionButton");
  });

  it("renders loading feedback and disables the composer", () => {
    expect(panelSource).toContain("<TypingIndicator");
    expect(panelSource).toContain(":disabled=\"isWaiting\"");
  });

  it("renders a recoverable error", () => {
    expect(panelSource).toContain('class="error-card"');
    expect(panelSource).toContain("state.error");
    expect(panelSource).toContain("Try again");
    expect(panelSource).toContain("retryMessage");
  });

  it("composes the visual primitives", () => {
    expect(panelSource).toContain("<AgentAvatar");
    expect(panelSource).toContain("<MessageBubble");
    expect(panelSource).toContain("<ChatComposer");
  });
});
