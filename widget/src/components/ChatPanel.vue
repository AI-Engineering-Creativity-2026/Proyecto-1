<script setup lang="ts">
import { computed, ref } from "vue";

import type { ChatState } from "@agichat/core";
import AgentAvatar from "./AgentAvatar.vue";
import ChatComposer from "./ChatComposer.vue";
import MessageBubble from "./MessageBubble.vue";
import SuggestionButton from "./SuggestionButton.vue";
import TypingIndicator from "./TypingIndicator.vue";

const props = defineProps<{
  state: ChatState;
  sendMessage: (text: string) => void;
  retryLastMessage: () => void;
  clearError: () => void;
}>();

const emit = defineEmits<{
  close: [];
}>();

const composerValue = ref("");
const isWaiting = computed(() => props.state.status === "waiting_response");
const hasMessages = computed(() => props.state.messages.length > 0);
const suggestions = [
  "Explain my latest invoice",
  "Update my account details",
  "Talk to a support specialist",
] as const;

function submitMessage(message: string): void {
  composerValue.value = "";
  props.sendMessage(message);
}

function retryMessage(): void {
  props.clearError();
  props.retryLastMessage();
}
</script>

<template>
  <section class="chat-panel" :data-state="state.status" aria-label="Chat with Nova">
    <header class="chat-header">
      <div class="chat-header__identity">
        <AgentAvatar label="Nova" online />
        <div>
          <h2>Nova</h2>
          <p>Online · Replies instantly</p>
        </div>
      </div>
      <button type="button" aria-label="Close chat" @click="emit('close')">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="m7 7 10 10M17 7 7 17" />
        </svg>
      </button>
    </header>

    <div class="chat-body" aria-live="polite">
      <div v-if="!hasMessages && state.status !== 'error'" class="empty-state">
        <AgentAvatar label="Nova" size="large" />
        <div class="empty-state__copy">
          <p class="eyebrow">YOUR AI GUIDE</p>
          <h3>Hi, I’m Nova.</h3>
          <p>Ask me anything about your account, billing, or getting started.</p>
        </div>
        <div class="suggestions" aria-label="Suggested questions">
          <SuggestionButton
            v-for="suggestion in suggestions"
            :key="suggestion"
            :label="suggestion"
            @select="submitMessage"
          />
        </div>
      </div>

      <template v-else>
        <div class="conversation-date"><span>Today</span></div>
        <div class="message-list">
          <MessageBubble
            v-for="message in state.messages"
            :key="message.id"
            :message="message"
          />
          <TypingIndicator v-if="isWaiting" />
        </div>

        <div v-if="state.status === 'error' && state.error" class="error-card" role="alert">
          <span class="error-card__icon" aria-hidden="true">
            <svg viewBox="0 0 20 20">
              <path d="M10 6v4.5M10 14h.01" />
              <circle cx="10" cy="10" r="7.5" />
            </svg>
          </span>
          <div>
            <strong>Message not sent</strong>
            <p>{{ state.error }}</p>
            <button type="button" @click="retryMessage">
              Try again
              <svg viewBox="0 0 16 16" aria-hidden="true">
                <path d="M13 7a5 5 0 1 0-1.3 4.7M13 3.5V7H9.5" />
              </svg>
            </button>
          </div>
        </div>
      </template>
    </div>

    <footer class="chat-footer">
      <ChatComposer
        :disabled="isWaiting"
        :initial-value="composerValue"
        @submit="submitMessage"
      />
      <p>Powered by <strong>AGIChat</strong></p>
    </footer>
  </section>
</template>
