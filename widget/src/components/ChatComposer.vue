<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { WIDGET_STRINGS } from "../i18n/strings";

const props = withDefaults(
  defineProps<{
    disabled?: boolean;
    initialValue?: string;
    assistantName?: string;
  }>(),
  {
    disabled: false,
    initialValue: "",
    assistantName: WIDGET_STRINGS.defaultAssistantName,
  },
);

const emit = defineEmits<{
  submit: [message: string];
}>();

const message = ref(props.initialValue);
const canSend = computed(() => !props.disabled && message.value.trim().length > 0);

watch(
  () => props.initialValue,
  (value) => {
    message.value = value;
  },
);

function submit(): void {
  const value = message.value.trim();

  if (!value || props.disabled) return;

  emit("submit", value);
  message.value = "";
}
</script>

<template>
  <form class="chat-composer" @submit.prevent="submit">
    <label class="sr-only" for="agichat-message">{{ WIDGET_STRINGS.inputLabel(assistantName) }}</label>
    <textarea
      id="agichat-message"
      v-model="message"
      rows="1"
      maxlength="2000"
      :disabled="disabled"
      :placeholder="disabled ? WIDGET_STRINGS.inputPlaceholderTyping(assistantName) : WIDGET_STRINGS.inputPlaceholderIdle(assistantName)"
      @keydown.enter.exact.prevent="submit"
    ></textarea>
    <button type="submit" :disabled="!canSend" :aria-label="WIDGET_STRINGS.sendMessageLabel">
      <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M5 12h14M13 6l6 6-6 6" />
      </svg>
    </button>
  </form>
</template>
