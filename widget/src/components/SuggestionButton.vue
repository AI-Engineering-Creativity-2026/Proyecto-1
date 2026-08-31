<script setup lang="ts">
defineProps<{
  label: string;
}>();

defineEmits<{
  select: [label: string];
}>();
</script>

<template>
  <button class="suggestion-button" type="button" @click="$emit('select', label)">
    <span>{{ label }}</span>
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path d="m7.5 4.5 5 5-5 5" />
    </svg>
  </button>
</template>
