<script setup lang="ts">
import { useChat } from "@agichat/core";
import { ref } from "vue";

import ChatPanel from "./components/ChatPanel.vue";
import {
  isAllowedExternalLink,
  type ExternalLinkAction,
} from "./utils/external-links";

const props = defineProps<{
  apiUrl: string;
  conversationId: string;
}>();

const pendingExternalAction = ref<ExternalLinkAction | null>(null);
const activationPollIntervalMs = 50;
const maxActivationWaitMs = 4_000;

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
</script>

<template>
  <main class="demo-shell">
    <section class="demo-intro" aria-labelledby="demo-title">
      <p class="demo-kicker">AGICHAT · WIDGET PREVIEW</p>
      <h1 id="demo-title">A calmer way to get answers.</h1>
      <p>Ask Nova anything and get a helpful answer from your support assistant.</p>
    </section>

    <section class="widget-stage" aria-label="AGIChat widget demo">
      <Transition name="panel">
        <ChatPanel
          v-if="isOpen"
          :state="chat.state.value"
          :send-message="chat.sendMessage"
          :retry-last-message="chat.retryLastMessage"
          :clear-error="chat.clearError"
          :external-action="pendingExternalAction"
          @close="isOpen = false"
          @open-external-link="retryExternalAction"
        />
      </Transition>

      <button
        class="chat-launcher"
        :class="{ 'chat-launcher--open': isOpen }"
        type="button"
        :aria-label="isOpen ? 'Close chat' : 'Open chat'"
        :aria-expanded="isOpen"
        @click="isOpen = !isOpen"
      >
        <svg v-if="!isOpen" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M6.5 18.2 3.8 20l.8-3.4A8 8 0 1 1 6.5 18.2Z" />
          <path d="M8 10.6h8M8 14h5" />
        </svg>
        <svg v-else viewBox="0 0 24 24" aria-hidden="true">
          <path d="m7 9.5 5 5 5-5" />
        </svg>
      </button>
    </section>
  </main>
</template>

<style src="./styles/widget.css"></style>
