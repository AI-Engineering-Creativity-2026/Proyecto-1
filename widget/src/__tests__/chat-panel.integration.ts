import { describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";

import type { ChatState, Message } from "@agichat/core";
import ChatPanel from "../components/ChatPanel.vue";

function createState(overrides: Partial<ChatState> = {}): ChatState {
  return {
    messages: [],
    status: "idle",
    error: null,
    ...overrides,
  };
}

function createUserMessage(status: Message["status"] = "sent"): Message {
  return {
    id: "message-1",
    role: "user",
    content: "Can you help me?",
    timestamp: "2026-09-22T12:00:00.000Z",
    status,
  };
}

describe("ChatPanel with real ChatState", () => {
  it("renders the empty state and sends a selected suggestion", async () => {
    const sendMessage = vi.fn<() => void>();
    const wrapper = mount(ChatPanel, {
      props: {
        state: createState(),
        sendMessage,
        retryLastMessage: vi.fn<() => void>(),
        clearError: vi.fn<() => void>(),
      },
    });

    expect(wrapper.find(".empty-state").exists()).toBe(true);
    await wrapper.find(".suggestion-button").trigger("click");

    expect(sendMessage).toHaveBeenCalledWith("Explain my latest invoice");
  });

  it("renders waiting_response with the typing indicator and disabled input", () => {
    const wrapper = mount(ChatPanel, {
      props: {
        state: createState({
          status: "waiting_response",
          messages: [createUserMessage("sending")],
        }),
        sendMessage: vi.fn<() => void>(),
        retryLastMessage: vi.fn<() => void>(),
        clearError: vi.fn<() => void>(),
      },
    });

    expect(wrapper.find(".typing-row").exists()).toBe(true);
    expect(wrapper.find("textarea").attributes("disabled")).toBeDefined();
    expect(wrapper.find(".message--user").text()).toContain("Can you help me?");
  });

  it("renders the core error and delegates retry plus clearError", async () => {
    const retryLastMessage = vi.fn<() => void>();
    const clearError = vi.fn<() => void>();
    const wrapper = mount(ChatPanel, {
      props: {
        state: createState({
          status: "error",
          error: "No se pudo procesar el mensaje.",
          messages: [createUserMessage("error")],
        }),
        sendMessage: vi.fn<() => void>(),
        retryLastMessage,
        clearError,
      },
    });

    expect(wrapper.find('[role="alert"]').text()).toContain(
      "No se pudo procesar el mensaje.",
    );
    await wrapper.get(".error-card button").trigger("click");

    expect(clearError).toHaveBeenCalledTimes(1);
    expect(retryLastMessage).toHaveBeenCalledTimes(1);
  });
});
