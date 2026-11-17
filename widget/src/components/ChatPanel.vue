<script setup lang="ts">
import { computed, ref } from "vue";
import type { ChatState } from "@agichat/core";

import { WIDGET_STRINGS } from "../i18n/strings";
import type { ExternalLinkAction } from "../utils/external-links";
import AgentAvatar from "./AgentAvatar.vue";
import ChatComposer from "./ChatComposer.vue";
import MessageBubble from "./MessageBubble.vue";
import ProviderAttribution from "./ProviderAttribution.vue";
import SuggestionButton from "./SuggestionButton.vue";
import TypingIndicator from "./TypingIndicator.vue";

const props = withDefaults(
  defineProps<{
    state: ChatState;
    sendMessage: (text: string) => void;
    retryLastMessage: () => void;
    clearError: () => void;
    externalAction?: ExternalLinkAction | null;
    assistantName?: string;
    mode?: "floating" | "docked";
  }>(),
  {
    externalAction: null,
    assistantName: WIDGET_STRINGS.defaultAssistantName,
    mode: "floating",
  },
);

const emit = defineEmits<{
  close: [];
  openExternalLink: [];
}>();

const composerValue = ref("");
const isWaiting = computed(() => props.state.status === "waiting_response");
const hasMessages = computed(() => props.state.messages.length > 0);
const externalLinkName = computed(() =>
  props.externalAction?.source === "imdb" ? "IMDb" : "Google Books",
);
const suggestions = WIDGET_STRINGS.suggestions;

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
  <section
    class="chat-panel"
    :class="`chat-panel--${mode}`"
    :data-state="state.status"
    :aria-label="WIDGET_STRINGS.chatWithLabel(assistantName)"
  >
    <header class="chat-header">
      <div class="chat-header__identity">
        <AgentAvatar :label="assistantName" online />
        <div>
          <h2>{{ assistantName }}</h2>
          <p>{{ WIDGET_STRINGS.headerStatus }}</p>
        </div>
      </div>
      <button
        type="button"
        class="chat-panel__close"
        :aria-label="WIDGET_STRINGS.closeChatLabel"
        @click="emit('close')"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="m7 7 10 10M17 7 7 17" />
        </svg>
      </button>
    </header>

    <div class="chat-body" aria-live="polite">
      <div v-if="!hasMessages && state.status !== 'error'" class="empty-state">
        <AgentAvatar :label="assistantName" size="large" />
        <div class="empty-state__copy">
          <p class="eyebrow">{{ WIDGET_STRINGS.welcomeEyebrow }}</p>
          <h3>{{ WIDGET_STRINGS.welcomeGreeting(assistantName) }}</h3>
          <p>{{ WIDGET_STRINGS.welcomeSubtitle }}</p>
          <p class="empty-state__capability">{{ WIDGET_STRINGS.welcomeComparisonNote }}</p>
        </div>
        <div
          class="suggestions"
          role="group"
          :aria-label="WIDGET_STRINGS.suggestionsGroupLabel"
        >
          <SuggestionButton
            v-for="suggestion in suggestions"
            :key="suggestion"
            :label="suggestion"
            @select="submitMessage"
          />
        </div>
      </div>

      <template v-else>
        <div class="conversation-date"><span>{{ WIDGET_STRINGS.todayLabel }}</span></div>
        <div class="message-list">
          <MessageBubble
            v-for="message in state.messages"
            :key="message.id"
            :message="message"
            :assistant-name="assistantName"
            :show-inline-providers="false"
          />
          <TypingIndicator v-if="isWaiting" :assistant-name="assistantName" />
        </div>

        <div v-if="state.status === 'error' && state.error" class="error-card" role="alert">
          <span class="error-card__icon" aria-hidden="true">
            <svg viewBox="0 0 20 20">
              <path d="M10 6v4.5M10 14h.01" />
              <circle cx="10" cy="10" r="7.5" />
            </svg>
          </span>
          <div>
            <strong>{{ WIDGET_STRINGS.errorTitle }}</strong>
            <p>{{ state.error }}</p>
            <button type="button" @click="retryMessage">
              {{ WIDGET_STRINGS.retryLabel }}
              <svg viewBox="0 0 16 16" aria-hidden="true">
                <path d="M13 7a5 5 0 1 0-1.3 4.7M13 3.5V7H9.5" />
              </svg>
            </button>
          </div>
        </div>
      </template>

      <div v-if="externalAction" class="external-link-fallback" role="status">
        <p>{{ WIDGET_STRINGS.popupBlockedMessage }}</p>
        <button
          type="button"
          :aria-label="WIDGET_STRINGS.openExternalAriaLabel(externalLinkName)"
          @click="emit('openExternalLink')"
        >
          {{ WIDGET_STRINGS.openExternalLabel(externalLinkName) }}
        </button>
      </div>
    </div>

    <footer class="chat-footer">
      <ProviderAttribution :providers="['tmdb', 'google_books']" />
      <ChatComposer
        :disabled="isWaiting"
        :initial-value="composerValue"
        :assistant-name="assistantName"
        @submit="submitMessage"
      />
    </footer>
  </section>
</template>
