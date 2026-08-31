<script setup lang="ts">
import { computed, ref } from "vue";

import { mockErrorMessage, mockMessages, mockSuggestions } from "../mock/chat";
import type { DemoState } from "../types/ui";
import AgentAvatar from "./AgentAvatar.vue";
import ChatComposer from "./ChatComposer.vue";
import MessageBubble from "./MessageBubble.vue";
import SuggestionButton from "./SuggestionButton.vue";
import TypingIndicator from "./TypingIndicator.vue";

const props = defineProps<{
  demoState: DemoState;
}>();

const emit = defineEmits<{
  close: [];
  changeState: [state: DemoState];
}>();

const composerValue = ref("");
const visibleMessages = computed(() =>
  props.demoState === "loading" ? mockMessages.slice(0, 2) : mockMessages,
);

function useSuggestion(suggestion: string): void {
  composerValue.value = suggestion;
}

function sendMockMessage(): void {
  composerValue.value = "";
  emit("changeState", "loading");
}
</script>

<template>
  <section class="chat-panel" :data-state="demoState" aria-label="Chat with Nova">
    <header class="chat-header">
      <div class="chat-header__identity">
        <AgentAvatar label="Nova" online />
        <div>
          <h2>Nova</h2>
          <p><span aria-hidden="true"></span> Online · Replies instantly</p>
        </div>
      </div>
      <button type="button" aria-label="Close chat" @click="$emit('close')">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="m7 7 10 10M17 7 7 17" />
        </svg>
      </button>
    </header>

    <div class="chat-body" aria-live="polite">
      <div v-if="demoState === 'empty'" class="empty-state">
        <AgentAvatar label="Nova" size="large" />
        <div class="empty-state__copy">
          <p class="eyebrow">YOUR AI GUIDE</p>
          <h3>Hi, I’m Nova.</h3>
          <p>Ask me anything about your account, billing, or getting started.</p>
        </div>
        <div class="suggestions" aria-label="Suggested questions">
          <SuggestionButton
            v-for="suggestion in mockSuggestions"
            :key="suggestion"
            :label="suggestion"
            @select="useSuggestion"
          />
        </div>
      </div>

      <template v-else>
        <div class="conversation-date"><span>Today</span></div>
        <div class="message-list">
          <MessageBubble
            v-for="message in visibleMessages"
            :key="message.id"
            :message="message"
          />
          <TypingIndicator v-if="demoState === 'loading'" />
        </div>

        <div v-if="demoState === 'error'" class="error-card" role="alert">
          <span class="error-card__icon" aria-hidden="true">
            <svg viewBox="0 0 20 20">
              <path d="M10 6v4.5M10 14h.01" />
              <circle cx="10" cy="10" r="7.5" />
            </svg>
          </span>
          <div>
            <strong>Message not sent</strong>
            <p>{{ mockErrorMessage }}</p>
            <button type="button" @click="$emit('changeState', 'loading')">
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
        :disabled="demoState === 'loading'"
        :initial-value="composerValue"
        @submit="sendMockMessage"
      />
      <p>Powered by <strong>AGIChat</strong></p>
    </footer>
  </section>
</template>
