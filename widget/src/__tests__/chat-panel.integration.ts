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
  it("renders the welcome ticket empty state and hides it once messages arrive", () => {
    const wrapper = mount(ChatPanel, {
      props: {
        state: createState(),
        sendMessage: vi.fn<(message: string) => void>(),
        retryLastMessage: vi.fn<() => void>(),
        clearError: vi.fn<() => void>(),
      },
    });

    expect(wrapper.find(".empty-state").exists()).toBe(true);
    expect(wrapper.find(".welcome-ticket").exists()).toBe(true);
    expect(wrapper.findAll("button.suggestion-button")).toHaveLength(0);
    expect(wrapper.text()).toContain("FUNCIÓN DE NOCHE");

    const populated = mount(ChatPanel, {
      props: {
        state: createState({
          messages: [
            {
              id: "m1",
              role: "user",
              content: "Hola",
              timestamp: "2026-11-17T12:00:00.000Z",
              status: "sent",
            },
          ],
        }),
        sendMessage: vi.fn<(message: string) => void>(),
        retryLastMessage: vi.fn<() => void>(),
        clearError: vi.fn<() => void>(),
      },
    });
    expect(populated.find(".welcome-ticket").exists()).toBe(false);
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

  it("renders friendly recoverable copy for each agent error state", () => {
    const messages = [
      "El servicio está recibiendo demasiadas solicitudes. Intenta de nuevo en unos momentos.",
      "El agente tardó demasiado en responder. Intenta de nuevo.",
      "No puedo procesar ese mensaje. Prueba con una solicitud distinta.",
      "Un servicio externo no está disponible ahora. Intenta de nuevo.",
      "No se pudo preparar una respuesta. Intenta de nuevo.",
    ];

    for (const message of messages) {
      const wrapper = mount(ChatPanel, {
        props: {
          state: createState({ status: "error", error: message }),
          sendMessage: vi.fn<() => void>(),
          retryLastMessage: vi.fn<() => void>(),
          clearError: vi.fn<() => void>(),
        },
      });

      expect(wrapper.get('[role="alert"]').text()).toContain(message);
      expect(wrapper.get(".error-card button").text()).toContain("Intentar de nuevo");
    }
  });
});
