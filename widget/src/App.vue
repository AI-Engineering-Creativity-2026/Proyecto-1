<script setup lang="ts">
import { useChat } from "@agichat/core";
import { ref } from "vue";

import ChatPanel from "./components/ChatPanel.vue";

const props = withDefaults(
  defineProps<{
    apiUrl?: string;
    conversationId?: string;
  }>(),
  {
    apiUrl: "ws://localhost:3000/ws",
    conversationId: "",
  },
);

const chat = useChat({
  apiUrl: props.apiUrl,
  conversationId: props.conversationId || crypto.randomUUID(),
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
          @close="isOpen = false"
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
