<script setup lang="ts">
import AgentAvatar from "./AgentAvatar.vue";
</script>

<template>
  <div class="typing-row" role="status" aria-label="Nova is typing">
    <AgentAvatar label="Nova" />
    <div class="typing-bubble" aria-hidden="true">
      <span></span>
      <span></span>
      <span></span>
    </div>
    <span class="sr-only">Nova is typing</span>
  </div>
</template>
