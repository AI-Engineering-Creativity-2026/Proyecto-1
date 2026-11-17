<script setup lang="ts">
import { onMounted, onUnmounted } from "vue";
import { destroy, init } from "../index";
import SelmaClapperIcon from "./SelmaClapperIcon.vue";

const props = defineProps<{
  apiUrl: string;
}>();

defineEmits<{
  navigateLanding: [];
}>();

const chips = [
  "Recomiéndame ciencia ficción",
  "Compara Blade Runner con su libro",
  "¿Vale la pena ver Dune?",
] as const;

function sendChip(text: string): void {
  window.dispatchEvent(new CustomEvent("agichat:send", { detail: { text } }));
}

onMounted(() => {
  init({
    containerId: "selma-chat-dock",
    apiUrl: props.apiUrl,
    conversationId: "selma-chat",
    assistantName: "Selma",
    mode: "dock",
    theme: {
      primaryColor: "#ff4a1c",
    },
  });
});

onUnmounted(() => {
  destroy();
});
</script>

<template>
  <div class="chat-page">
    <div class="chat-page__hero-col">
      <header class="chat-page__topbar">
        <a
          href="#/"
          class="brand-wordmark"
          aria-label="Mook, volver al inicio"
          @click.prevent="$emit('navigateLanding')"
        >
          <SelmaClapperIcon />
          <span>Mook</span>
        </a>
        <a
          href="#/"
          class="chat-page__back"
          @click.prevent="$emit('navigateLanding')"
        >
          Volver al inicio
        </a>
      </header>

      <main class="chat-page__editorial">
        <h1 id="chat-hero-title">¿Qué vemos esta noche?</h1>
        <p class="chat-page__subtitle">
          Pide una recomendación de cine o descubre cómo se compara una película con el libro que la inspiró.
        </p>
        <div class="chat-page__chips" role="group" aria-label="Sugerencias rápidas para Selma">
          <button
            v-for="chip in chips"
            :key="chip"
            type="button"
            class="hero-chip"
            @click="sendChip(chip)"
          >
            {{ chip }}
          </button>
        </div>
      </main>

      <footer class="chat-page__bottombar">
        <span>Datos de películas por TMDB · Libros por Google Books</span>
      </footer>
    </div>

    <aside id="selma-chat-dock" class="chat-page__dock" aria-label="Panel de conversación con Selma"></aside>
  </div>
</template>
