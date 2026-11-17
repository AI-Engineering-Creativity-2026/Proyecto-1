<script setup lang="ts">
import { computed, ref, watch } from "vue";

const props = withDefaults(
  defineProps<{
    disabled?: boolean;
    initialValue?: string;
    assistantName?: string;
  }>(),
  {
    disabled: false,
    initialValue: "",
    assistantName: "Selma",
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
    <label class="sr-only" for="agichat-message">Escribe un mensaje para {{ assistantName }}</label>
    <textarea
      id="agichat-message"
      v-model="message"
      rows="1"
      maxlength="2000"
      :disabled="disabled"
      :placeholder="disabled ? `${assistantName} está escribiendo…` : `Pregúntale a ${assistantName}…`"
      @keydown.enter.exact.prevent="submit"
    ></textarea>
    <button type="submit" :disabled="!canSend" aria-label="Enviar mensaje">
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M5 12h14M13 6l6 6-6 6" />
      </svg>
    </button>
  </form>
</template>
