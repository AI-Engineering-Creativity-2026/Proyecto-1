<script setup lang="ts">
withDefaults(
  defineProps<{
    label?: string;
    online?: boolean;
    size?: "small" | "large";
  }>(),
  {
    label: "Nova",
    online: false,
    size: "small",
  },
);
</script>

<template>
  <span
    class="agent-avatar"
    :class="`agent-avatar--${size}`"
    role="img"
    :aria-label="`${label} avatar${online ? ', online' : ''}`"
  >
    <svg viewBox="0 0 48 48" aria-hidden="true">
      <path
        d="M24 7.2c3.6 0 4.2 6.7 7.2 8.4 3.1 1.8 8.6-2 10.4 1.1 1.8 3-4.2 6.1-4.2 9.7 0 3.5 6 6.7 4.2 9.7-1.8 3.1-7.3-.7-10.4 1.1-3 1.7-3.6 8.4-7.2 8.4s-4.2-6.7-7.2-8.4c-3.1-1.8-8.6 2-10.4-1.1-1.8-3 4.2-6.2 4.2-9.7 0-3.6-6-6.7-4.2-9.7 1.8-3.1 7.3.7 10.4-1.1 3-1.7 3.6-8.4 7.2-8.4Z"
      />
      <circle cx="24" cy="24" r="7" />
      <circle cx="21.5" cy="22.5" r="1" />
      <circle cx="26.5" cy="22.5" r="1" />
      <path d="M20.8 26c1.8 1.6 4.6 1.6 6.4 0" />
    </svg>
    <span v-if="online" class="agent-avatar__status" aria-hidden="true"></span>
  </span>
</template>
