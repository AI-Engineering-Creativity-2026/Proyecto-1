<script setup lang="ts">
import { onMounted, onUnmounted, ref } from "vue";
import { destroy, init } from "../index";
import SelmaClapperIcon from "./SelmaClapperIcon.vue";

const props = defineProps<{
  apiUrl: string;
}>();

defineEmits<{
  navigateLanding: [];
}>();

interface QuotaItem {
  used: number;
  limit: number;
  usedPct: number;
  tpmLimit?: number;
  tpmUsedPct?: number;
}

interface QuotaSummary {
  groq: QuotaItem | null;
  tmdb: QuotaItem | null;
  google_books: QuotaItem | null;
}

const quota = ref<QuotaSummary | null>(null);
let quotaTimer: ReturnType<typeof setInterval> | null = null;

function quotaEndpoint(): string | null {
  try {
    const parsed = new URL(props.apiUrl);
    parsed.protocol = parsed.protocol === "wss:" ? "https:" : "http:";
    parsed.pathname = "/api/quota";
    parsed.search = "";
    return parsed.toString();
  } catch {
    return null;
  }
}

async function refreshQuota(): Promise<void> {
  const url = quotaEndpoint();
  if (!url) return;
  try {
    const res = await fetch(url);
    if (res.ok) {
      quota.value = (await res.json()) as QuotaSummary;
    }
  } catch {
    // Ignore when server is offline (e.g. unit tests / static preview)
  }
}

const chips = [
  "Recomiéndame ciencia ficción",
  "Compara Blade Runner con su libro",
  "¿Vale la pena ver Dune?",
  "Recomiéndame un thriller psicológico",
  "Compara El Resplandor con la novela de Stephen King",
  "¿Es fiel Fight Club al libro de Chuck Palahniuk?",
  "Sugiere una película de fantasía épica con póster",
  "Compara No Country for Old Men con su novela",
  "Quiero ver algo de misterio y suspenso",
] as const;

function sendChip(text: string): void {
  window.dispatchEvent(new CustomEvent("agichat:send", { detail: { text } }));
  window.setTimeout(() => {
    void refreshQuota();
  }, 1_500);
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
  void refreshQuota();
  quotaTimer = window.setInterval(() => {
    void refreshQuota();
  }, 30_000);
});

onUnmounted(() => {
  if (quotaTimer !== null) {
    window.clearInterval(quotaTimer);
  }
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
        <div v-if="quota" class="quota-strip" aria-label="Uso actual de APIs">
          <span>
            Groq:
            <strong>{{ quota.groq ? `${quota.groq.usedPct}% (${quota.groq.used}/${quota.groq.limit})` : "—" }}</strong>
          </span>
          <span>
            TMDB:
            <strong>{{ quota.tmdb ? `${quota.tmdb.usedPct}% (${quota.tmdb.used}/${quota.tmdb.limit})` : "—" }}</strong>
          </span>
          <span>
            Google Books:
            <strong>{{ quota.google_books ? `${quota.google_books.usedPct}% (${quota.google_books.used}/${quota.google_books.limit})` : "—" }}</strong>
          </span>
        </div>
        <span>Datos de películas por TMDB · Libros por Google Books</span>
      </footer>
    </div>

    <aside id="selma-chat-dock" class="chat-page__dock" aria-label="Panel de conversación con Selma"></aside>
  </div>
</template>
