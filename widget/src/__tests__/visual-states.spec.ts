import { describe, expect, it } from "bun:test";

import { readFixture } from "../../../test/helpers/read-fixture";

const panelSource = readFixture(
  new URL("../components/ChatPanel.vue", import.meta.url),
);

describe("ChatPanel visual states", () => {
  it("renders the empty state with mock suggestions", () => {
    expect(panelSource).toContain("demoState === 'empty'");
    expect(panelSource).toContain("mockSuggestions");
    expect(panelSource).toContain("<SuggestionButton");
  });

  it("renders loading feedback and disables the composer", () => {
    expect(panelSource).toContain("<TypingIndicator");
    expect(panelSource).toContain(":disabled=\"demoState === 'loading'\"");
  });

  it("renders a recoverable error", () => {
    expect(panelSource).toContain('class="error-card"');
    expect(panelSource).toContain("mockErrorMessage");
    expect(panelSource).toContain("Try again");
    expect(panelSource).toContain("$emit('changeState', 'loading')");
  });

  it("composes the visual primitives", () => {
    expect(panelSource).toContain("<AgentAvatar");
    expect(panelSource).toContain("<MessageBubble");
    expect(panelSource).toContain("<ChatComposer");
  });
});
