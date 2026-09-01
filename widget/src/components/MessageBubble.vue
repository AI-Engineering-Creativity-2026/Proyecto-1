<script setup lang="ts">
import type { Message } from "../../../packages/core/src/types/chat";

import AgentAvatar from "./AgentAvatar.vue";

defineProps<{
  message: Message;
}>();

function formatTime(timestamp: string): string {
  return new Intl.DateTimeFormat("en", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(new Date(timestamp));
}
</script>

<template>
  <article class="message" :class="`message--${message.role}`">
    <AgentAvatar v-if="message.role === 'agent'" label="Nova" />
    <div class="message__content">
      <div class="message__bubble">
        <p>{{ message.content }}</p>
      </div>
      <div class="message__meta">
        <span>{{ formatTime(message.timestamp) }}</span>
        <span v-if="message.status === 'sent'" class="message__sent" aria-label="Sent">
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d="m2.5 8.5 2.2 2.2 4-4.4M7.3 10.7l1.1 1.1 5.1-5.5" />
          </svg>
        </span>
      </div>
    </div>
  </article>
</template>
