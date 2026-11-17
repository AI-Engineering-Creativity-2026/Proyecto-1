<script setup lang="ts">
import { WIDGET_STRINGS } from "../i18n/strings";
import AgentAvatar from "./AgentAvatar.vue";

withDefaults(
  defineProps<{
    assistantName?: string;
  }>(),
  {
    assistantName: WIDGET_STRINGS.defaultAssistantName,
  },
);
</script>

<template>
  <div class="typing-row" role="status" :aria-label="WIDGET_STRINGS.typingLabel(assistantName)">
    <AgentAvatar :label="assistantName" />
    <div class="typing-bubble" aria-hidden="true">
      <span></span>
      <span></span>
      <span></span>
    </div>
    <span class="sr-only">{{ WIDGET_STRINGS.typingLabel(assistantName) }}</span>
  </div>
</template>
