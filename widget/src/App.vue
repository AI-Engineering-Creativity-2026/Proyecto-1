<script setup lang="ts">
import { useChat } from "@agichat/core";
import { onMounted, onUnmounted, ref } from "vue";

import ChatPanel from "./components/ChatPanel.vue";
import SelmaClapperIcon from "./components/SelmaClapperIcon.vue";
import {
  isAllowedExternalLink,
  type ExternalLinkAction,
} from "./utils/external-links";

const props = withDefaults(
  defineProps<{
    apiUrl: string;
    conversationId: string;
    assistantName?: string;
    mode?: "floating" | "dock";
  }>(),
  {
    assistantName: "Selma",
    mode: "floating",
  },
);

const pendingExternalAction = ref<ExternalLinkAction | null>(null);
const activationPollIntervalMs = 50;
const maxActivationWaitMs = 6_000;

function attemptExternalOpen(action: ExternalLinkAction): void {
  const openedWindow = window.open(action.url, "_blank");

  if (!openedWindow) {
    pendingExternalAction.value = action;
    return;
  }

  openedWindow.opener = null;
  pendingExternalAction.value = null;
}

function openExternalAction(action: ExternalLinkAction): void {
  if (!isAllowedExternalLink(action)) return;

  const startedAt = Date.now();
  const waitForActivationToExpire = (): void => {
    const isStillActive = navigator.userActivation?.isActive === true;

    if (isStillActive && Date.now() - startedAt < maxActivationWaitMs) {
      window.setTimeout(waitForActivationToExpire, activationPollIntervalMs);
      return;
    }

    if (isStillActive) {
      pendingExternalAction.value = action;
      return;
    }

    attemptExternalOpen(action);
  };

  waitForActivationToExpire();
}

function retryExternalAction(): void {
  if (pendingExternalAction.value) {
    attemptExternalOpen(pendingExternalAction.value);
  }
}

const chat = useChat({
  apiUrl: props.apiUrl,
  conversationId: props.conversationId,
  onAction: openExternalAction,
});

const isOpen = ref(true);

function handleExternalSend(event: Event): void {
  const detail = (event as CustomEvent<{ text?: string }>).detail;
  const text = detail?.text?.trim();
  if (!text) return;
  isOpen.value = true;
  chat.sendMessage(text);
}

onMounted(() => {
  window.addEventListener("agichat:send", handleExternalSend);
});

onUnmounted(() => {
  window.removeEventListener("agichat:send", handleExternalSend);
});
</script>

<template>
  <section
    class="widget-stage"
    :class="{ 'widget-stage--dock': mode === 'dock' }"
    :aria-label="`Asistente de cine y libros ${assistantName}`"
  >
    <Transition name="panel">
      <ChatPanel
        v-if="isOpen || mode === 'dock'"
        :state="chat.state.value"
        :send-message="chat.sendMessage"
        :retry-last-message="chat.retryLastMessage"
        :clear-error="chat.clearError"
        :external-action="pendingExternalAction"
        :assistant-name="assistantName"
        :docked="mode === 'dock'"
        @close="isOpen = false"
        @open-external-link="retryExternalAction"
      />
    </Transition>

    <button
      class="chat-launcher"
      :class="{
        'chat-launcher--open': isOpen,
        'chat-launcher--dock-hidden': mode === 'dock',
      }"
      type="button"
      :aria-label="isOpen ? 'Cerrar chat' : 'Abrir chat'"
      :aria-expanded="isOpen"
      @click="isOpen = !isOpen"
    >
      <SelmaClapperIcon v-if="!isOpen" />
      <svg v-else viewBox="0 0 24 24" aria-hidden="true">
        <path d="m7 9.5 5 5 5-5" />
      </svg>
    </button>
  </section>
</template>

<style src="./styles/widget.css"></style>
