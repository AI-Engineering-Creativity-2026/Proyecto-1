import { describe, expect, it } from "bun:test";

import { readFixture } from "../../../test/helpers/read-fixture";

describe("App", () => {
  it("connects the widget to the core chat composable", () => {
    const source = readFixture(new URL("../App.vue", import.meta.url));

    expect(source).toContain('import { useChat } from "@agichat/core"');
    expect(source).toContain("const chat = useChat");
    expect(source).toContain(":state=\"chat.state.value\"");
    expect(source).toContain(":send-message=\"chat.sendMessage\"");
    expect(source).toContain(":retry-last-message=\"chat.retryLastMessage\"");
    expect(source).toContain(":clear-error=\"chat.clearError\"");
  });

  it("renders the chat panel and launcher", () => {
    const source = readFixture(new URL("../App.vue", import.meta.url));

    expect(source).toContain("<ChatPanel");
    expect(source).toContain("chat-launcher");
  });
});
