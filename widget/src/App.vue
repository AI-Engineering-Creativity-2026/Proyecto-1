<script setup lang="ts">
import { ref } from "vue";

import ChatPanel from "./components/ChatPanel.vue";
import type { DemoState } from "./types/ui";

const demoStates: ReadonlyArray<{ label: string; value: DemoState }> = [
  { label: "Conversation", value: "conversation" },
  { label: "Empty", value: "empty" },
  { label: "Loading", value: "loading" },
  { label: "Error", value: "error" },
];

const activeState = ref<DemoState>("conversation");
const isOpen = ref(true);

function selectState(state: DemoState): void {
  activeState.value = state;
  isOpen.value = true;
}
</script>

<template>
  <main class="demo-shell">
    <section class="demo-intro" aria-labelledby="demo-title">
      <p class="demo-kicker">AGICHAT · WIDGET PREVIEW</p>
      <h1 id="demo-title">A calmer way to get answers.</h1>
      <p>Explore the visual states of the embeddable support assistant.</p>

      <div class="state-switcher" aria-label="Widget preview state">
        <button
          v-for="state in demoStates"
          :key="state.value"
          class="state-switcher__button"
          :class="{ 'state-switcher__button--active': activeState === state.value }"
          type="button"
          :aria-pressed="activeState === state.value"
          @click="selectState(state.value)"
        >
          {{ state.label }}
        </button>
      </div>
    </section>

    <section class="widget-stage" aria-label="AGIChat widget demo">
      <Transition name="panel">
        <ChatPanel
          v-if="isOpen"
          :demo-state="activeState"
          @close="isOpen = false"
          @change-state="activeState = $event"
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
