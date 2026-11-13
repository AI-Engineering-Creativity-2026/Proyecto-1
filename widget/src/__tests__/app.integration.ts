import { describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";
import { ref } from "vue";

import type { ChatState } from "@agichat/core";

const state: ChatState = { messages: [], status: "idle", error: null };
const sendMessage = vi.fn<() => void>();

vi.mock("@agichat/core", () => ({
  useChat: () => ({
    state: ref(state),
    sendMessage,
    retryLastMessage: vi.fn<() => void>(),
    clearError: vi.fn<() => void>(),
  }),
}));

import App from "../App.vue";

describe("App", () => {
  it("renders the widget and toggles the launcher", async () => {
    const wrapper = mount(App, {
      props: {
        apiUrl: "ws://localhost:3000/ws",
        conversationId: "conversation-test",
      },
    });

    expect(wrapper.find(".chat-panel").exists()).toBe(true);
    await wrapper.find(".chat-launcher").trigger("click");
    expect(wrapper.find(".chat-panel").exists()).toBe(false);
    await wrapper.find(".chat-launcher").trigger("click");
    expect(wrapper.find(".chat-panel").exists()).toBe(true);
  });
});
