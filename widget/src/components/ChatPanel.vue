<script setup lang="ts">
import { computed, ref } from "vue";

import type { ChatState } from "@agichat/core";
import type { ExternalLinkAction } from "../utils/external-links";
import AgentAvatar from "./AgentAvatar.vue";
import ChatComposer from "./ChatComposer.vue";
import MessageBubble from "./MessageBubble.vue";
import TypingIndicator from "./TypingIndicator.vue";

const props = withDefaults(
  defineProps<{
    state: ChatState;
    sendMessage: (text: string) => void;
    retryLastMessage: () => void;
    clearError: () => void;
    externalAction?: ExternalLinkAction | null;
    assistantName?: string;
    docked?: boolean;
  }>(),
  {
    externalAction: null,
    assistantName: "Selma",
    docked: false,
  },
);

const emit = defineEmits<{
  close: [];
  openExternalLink: [];
}>();

const composerValue = ref("");
const isWaiting = computed(() => props.state.status === "waiting_response");
const hasMessages = computed(() => props.state.messages.length > 0);
const externalLinkName = computed(() =>
  props.externalAction?.source === "imdb" ? "IMDb" : "Google Books",
);

function submitMessage(message: string): void {
  composerValue.value = "";
  props.sendMessage(message);
}

function retryMessage(): void {
  props.clearError();
  props.retryLastMessage();
}
</script>

<template>
  <section
    class="chat-panel"
    :class="{ 'chat-panel--dock': docked }"
    :data-state="state.status"
    :aria-label="`Chat con ${assistantName}`"
  >
    <header class="chat-header">
      <div class="chat-header__identity">
        <AgentAvatar :label="assistantName" online />
        <div>
          <h2>{{ assistantName }}</h2>
          <p>En línea · Responde al instante</p>
        </div>
      </div>
      <button
        type="button"
        class="chat-panel__close"
        aria-label="Cerrar chat"
        @click="emit('close')"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="m7 7 10 10M17 7 7 17" />
        </svg>
      </button>
    </header>

    <div class="chat-body" aria-live="polite">
      <div v-if="!hasMessages && state.status !== 'error'" class="empty-state">
        <div class="welcome-ticket">
          <div class="welcome-ticket__head">
            <AgentAvatar :label="assistantName" size="large" />
            <span class="welcome-ticket__badge">FUNCIÓN DE NOCHE</span>
          </div>
          <div class="empty-state__copy">
            <p class="eyebrow">TU GUÍA DE CINE Y LIBROS</p>
            <h3>¡Hola, soy {{ assistantName }}!</h3>
            <p>
              Elige cualquiera de los temas de la izquierda o escríbeme aquí abajo para descubrir tu próxima película y compararla con su libro.
            </p>
          </div>
          <ul class="welcome-ticket__highlights" aria-label="Capacidades de Selma">
            <li>Póster y ficha oficial en TMDB</li>
            <li>Comparación directa con su novela</li>
            <li>Veredicto honesto: ¿vale la pena verla?</li>
          </ul>
        </div>
      </div>

      <template v-else>
        <div class="conversation-date"><span>Hoy</span></div>
        <div class="message-list">
          <MessageBubble
            v-for="message in state.messages"
            :key="message.id"
            :message="message"
            :assistant-name="assistantName"
          />
          <TypingIndicator v-if="isWaiting" :assistant-name="assistantName" />
        </div>

        <div v-if="state.status === 'error' && state.error" class="error-card" role="alert">
          <span class="error-card__icon" aria-hidden="true">
            <svg viewBox="0 0 20 20">
              <path d="M10 6v4.5M10 14h.01" />
              <circle cx="10" cy="10" r="7.5" />
            </svg>
          </span>
          <div>
            <strong>No se pudo enviar el mensaje</strong>
            <p>{{ state.error }}</p>
            <button type="button" @click="retryMessage">
              Intentar de nuevo
              <svg viewBox="0 0 16 16" aria-hidden="true">
                <path d="M13 7a5 5 0 1 0-1.3 4.7M13 3.5V7H9.5" />
              </svg>
            </button>
          </div>
        </div>
      </template>

      <div v-if="externalAction" class="external-link-fallback" role="status">
        <p>Tu navegador bloqueó la ventana emergente. Puedes abrir el enlace manualmente.</p>
        <button
          type="button"
          :aria-label="`Abrir ${externalLinkName} en una nueva pestaña`"
          @click="emit('openExternalLink')"
        >
          Abrir {{ externalLinkName }}
        </button>
      </div>
    </div>

    <footer class="chat-footer">
      <ChatComposer
        :disabled="isWaiting"
        :initial-value="composerValue"
        :assistant-name="assistantName"
        @submit="submitMessage"
      />
      <p class="chat-footer__note">Datos de películas por TMDB · Libros por Google Books</p>
    </footer>
  </section>
</template>
