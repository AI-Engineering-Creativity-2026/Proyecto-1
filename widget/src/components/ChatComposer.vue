<script setup lang="ts">
import { computed, ref, watch } from "vue";

const props = withDefaults(
  defineProps<{
    disabled?: boolean;
    initialValue?: string;
  }>(),
  {
    disabled: false,
    initialValue: "",
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
    <label class="sr-only" for="agichat-message">Message Nova</label>
    <textarea
      id="agichat-message"
      v-model="message"
      rows="1"
      :disabled="disabled"
      :placeholder="disabled ? 'Nova is typing…' : 'Write a message…'"
      @keydown.enter.exact.prevent="submit"
    ></textarea>
    <button type="submit" :disabled="!canSend" aria-label="Send message">
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4.2 4.9 20 12 4.2 19.1l1.4-5.5L14 12l-8.4-1.6-1.4-5.5Z" />
      </svg>
    </button>
  </form>
</template>
