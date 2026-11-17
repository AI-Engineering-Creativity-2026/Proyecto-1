import { describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";
import { nextTick, ref } from "vue";

import type { ChatState } from "@agichat/core";

type TestAction = {
  kind: "open_url";
  url: string;
  source: "imdb" | "google_books";
  reason?: string;
};

const actionCallback = vi.hoisted(() => ({
  current: null as ((action: TestAction) => void) | null,
}));

const state: ChatState = { messages: [], status: "idle", error: null };
const sendMessage = vi.fn<() => void>();

vi.mock("@agichat/core", () => ({
  useChat: (options: { onAction?: (action: TestAction) => void }) => {
    actionCallback.current = options.onAction ?? null;
    return {
      state: ref(state),
      sendMessage,
      retryLastMessage: vi.fn<() => void>(),
      clearError: vi.fn<() => void>(),
    };
  },
}));

import App from "../App.vue";

describe("App", () => {
  it("waits for transient user activation to expire before auto-opening", async () => {
    let isActive = true;
    const originalActivation = Object.getOwnPropertyDescriptor(navigator, "userActivation");
    Object.defineProperty(navigator, "userActivation", {
      configurable: true,
      value: { get isActive() { return isActive; } },
    });
    vi.useFakeTimers();

    const url = "https://www.imdb.com/title/tt0000001/";
    const popup = { opener: window } as unknown as Window;
    const open = vi.spyOn(window, "open").mockReturnValue(popup);
    const wrapper = mount(App, {
      props: {
        apiUrl: "ws://localhost:3000/ws",
        conversationId: "conversation-test",
      },
    });

    try {
      actionCallback.current?.({ kind: "open_url", url, source: "imdb" });
      expect(open).not.toHaveBeenCalled();

      isActive = false;
      await vi.advanceTimersByTimeAsync(50);
      await nextTick();

      expect(open).toHaveBeenCalledWith(url, "_blank");
      expect(popup.opener).toBeNull();
    } finally {
      wrapper.unmount();
      open.mockRestore();
      vi.useRealTimers();
      if (originalActivation) {
        Object.defineProperty(navigator, "userActivation", originalActivation);
      } else {
        Reflect.deleteProperty(navigator, "userActivation");
      }
    }
  });

  it("opens an allowed action and clears the popup opener", async () => {
    const url = "https://www.imdb.com/title/tt0000001/";
    const popup = {
      opener: window,
    } as unknown as Window;
    const open = vi.spyOn(window, "open").mockReturnValue(popup);
    const wrapper = mount(App, {
      props: {
        apiUrl: "ws://localhost:3000/ws",
        conversationId: "conversation-test",
      },
    });

    actionCallback.current?.({
      kind: "open_url",
      url,
      source: "imdb",
    });
    await nextTick();

    expect(open).toHaveBeenCalledWith(url, "_blank");
    expect(popup.opener).toBeNull();
    expect(wrapper.find('[role="status"]').exists()).toBe(false);

    const booksUrl = "https://books.google.com/books?id=volume-1";
    actionCallback.current?.({
      kind: "open_url",
      url: booksUrl,
      source: "google_books",
    });
    await nextTick();

    expect(open).toHaveBeenCalledTimes(2);
    expect(open).toHaveBeenLastCalledWith(booksUrl, "_blank");
    wrapper.unmount();
    open.mockRestore();
  });

  it("opens allowlisted HTTPS actions and offers an accessible button when blocked", async () => {
    const url = "https://www.imdb.com/title/tt0000001/";
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    const wrapper = mount(App, {
      props: {
        apiUrl: "ws://localhost:3000/ws",
        conversationId: "conversation-test",
      },
    });

    actionCallback.current?.({
      kind: "open_url",
      url,
      source: "imdb",
    });
    await nextTick();

    expect(open).toHaveBeenCalledWith(url, "_blank");
    expect(wrapper.get('[role="status"]').text()).toContain("bloqueó la ventana emergente");
    const fallbackButton = wrapper.get('[aria-label="Abrir IMDb en una nueva pestaña"]');
    expect(fallbackButton.exists()).toBe(true);

    await fallbackButton.trigger("click");
    expect(open).toHaveBeenCalledTimes(2);
    wrapper.unmount();
    open.mockRestore();
  });

  it("rejects non-HTTPS, unlisted, and source-mismatched actions in the widget", async () => {
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    const wrapper = mount(App, {
      props: {
        apiUrl: "ws://localhost:3000/ws",
        conversationId: "conversation-test",
      },
    });

    for (const action of [
      {
        kind: "open_url",
        url: "http://www.imdb.com/title/tt0000001/",
        source: "imdb",
      },
      {
        kind: "open_url",
        url: "https://attacker.example/title/tt0000001/",
        source: "imdb",
      },
      {
        kind: "open_url",
        url: "https://books.google.com/books?id=volume-1",
        source: "imdb",
      },
    ] as const) {
      actionCallback.current?.(action);
    }
    await nextTick();

    expect(open).not.toHaveBeenCalled();
    expect(wrapper.find('[role="status"]').exists()).toBe(false);
    wrapper.unmount();
    open.mockRestore();
  });

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
    wrapper.unmount();
  });

  it("supports dock mode and forwards agichat:send custom events", async () => {
    const wrapper = mount(App, {
      props: {
        apiUrl: "ws://localhost:3000/ws",
        conversationId: "conversation-test",
        mode: "dock",
        assistantName: "Selma",
      },
    });

    expect(wrapper.find(".widget-stage--dock").exists()).toBe(true);
    expect(wrapper.find(".chat-panel--dock").exists()).toBe(true);
    expect(wrapper.find(".chat-launcher--dock-hidden").exists()).toBe(true);

    window.dispatchEvent(
      new CustomEvent("agichat:send", {
        detail: { text: "Recomiéndame ciencia ficción" },
      }),
    );
    await nextTick();
    wrapper.unmount();
  });
});
