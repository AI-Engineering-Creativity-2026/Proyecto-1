<script setup lang="ts">
import SelmaClapperIcon from "./SelmaClapperIcon.vue";

withDefaults(
  defineProps<{
    label?: string;
    online?: boolean;
    size?: "small" | "large";
  }>(),
  {
    label: "Selma",
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
    :aria-label="`Avatar de ${label}${online ? ', en línea' : ''}`"
  >
    <SelmaClapperIcon />
    <span v-if="online" class="agent-avatar__status" aria-hidden="true"></span>
  </span>
</template>
