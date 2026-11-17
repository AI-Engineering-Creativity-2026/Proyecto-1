<script setup lang="ts">
import AgentAvatar from "./AgentAvatar.vue";

withDefaults(
  defineProps<{
    assistantName?: string;
  }>(),
  {
    assistantName: "Selma",
  },
);
</script>

<template>
  <div class="typing-row" role="status" :aria-label="`${assistantName} está escribiendo`">
    <AgentAvatar :label="assistantName" />
    <div class="typing-bubble" aria-hidden="true">
      <span></span>
      <span></span>
      <span></span>
    </div>
    <span class="sr-only">{{ assistantName }} está escribiendo</span>
  </div>
</template>
