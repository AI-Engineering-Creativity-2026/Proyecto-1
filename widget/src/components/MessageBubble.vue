<script setup lang="ts">
import { computed, ref } from "vue";
import type { Message } from "@agichat/core";

import { WIDGET_STRINGS } from "../i18n/strings";
import { isAllowedExternalLink } from "../utils/external-links";
import { renderMarkdown } from "../utils/markdown";
import { isAllowedPosterUrl } from "../utils/posters";
import AgentAvatar from "./AgentAvatar.vue";
import ProviderAttribution from "./ProviderAttribution.vue";

const props = withDefaults(
  defineProps<{
    message: Message;
    assistantName?: string;
    showInlineProviders?: boolean;
  }>(),
  {
    assistantName: WIDGET_STRINGS.defaultAssistantName,
    showInlineProviders: true,
  },
);

const failedPosterIndexes = ref<number[]>([]);

const parsedContent = computed(() => {
  if (props.message.role !== "agent") {
    return { body: props.message.content, verdict: null as string | null };
  }
  const verdictMatch = props.message.content.match(
    /(?:^|\n+)\s*\*{0,2}(Veredicto\s*:[^.\n]*(?:\.)?)\*{0,2}\s*$/i,
  );
  if (!verdictMatch || !verdictMatch[1]) {
    return { body: props.message.content, verdict: null as string | null };
  }
  const body = props.message.content.slice(0, verdictMatch.index).trim();
  return {
    body: body || props.message.content,
    verdict: verdictMatch[1].trim(),
  };
});

const featuredLinks = computed(() => {
  const actions = props.message.actions ?? [];
  return actions
    .filter((action) => isAllowedExternalLink(action))
    .map((action) => {
      if (action.source === "imdb") {
        const base = action.title?.trim() || "Película recomendada";
        const yearPart = action.year ? ` (${action.year})` : "";
        return {
          url: action.url,
          prefix: WIDGET_STRINGS.featuredMoviePrefix,
          label: `${base}${yearPart} — IMDb`,
        };
      }
      const base = action.title?.trim() || "Libro fuente";
      return {
        url: action.url,
        prefix: WIDGET_STRINGS.featuredBookPrefix,
        label: `${base} — Google Books`,
      };
    });
});

function formatTime(timestamp: string): string {
  return new Intl.DateTimeFormat("es", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(timestamp));
}

function handlePosterError(index: number): void {
  if (!failedPosterIndexes.value.includes(index)) {
    failedPosterIndexes.value.push(index);
  }
}
</script>

<template>
  <article class="message" :class="`message--${message.role}`">
    <AgentAvatar v-if="message.role === 'agent'" :label="assistantName" />
    <div class="message__content">
      <div
        class="message__bubble markdown-content"
        v-html="renderMarkdown(parsedContent.body)"
      ></div>
      <div
        v-if="message.role === 'agent' && message.attachments?.length"
        class="message__attachments"
      >
        <figure
          v-for="(attachment, index) in message.attachments"
          :key="`${message.id}-${index}`"
          class="poster-card"
        >
          <img
            v-if="isAllowedPosterUrl(attachment.url) && !failedPosterIndexes.includes(index)"
            :src="attachment.url"
            :alt="attachment.alt || attachment.title || 'Póster de película'"
            loading="lazy"
            decoding="async"
            referrerpolicy="no-referrer"
            @error="handlePosterError(index)"
          >
          <div
            v-else
            class="poster-card__fallback"
            role="img"
            :aria-label="`${attachment.alt || attachment.title || 'Póster de película'}; ${WIDGET_STRINGS.posterFallbackText}`"
          >
            <svg viewBox="0 0 32 32" aria-hidden="true">
              <rect x="6" y="4" width="20" height="24" rx="3" />
              <path d="M11 10h10M11 15h10M11 20h6" />
            </svg>
            <span>{{ WIDGET_STRINGS.posterFallbackText }}</span>
          </div>
          <figcaption v-if="attachment.title">{{ attachment.title }}</figcaption>
        </figure>
      </div>
      <section
        v-if="message.role === 'agent' && (featuredLinks.length > 0 || parsedContent.verdict)"
        class="featured-card"
        :aria-label="WIDGET_STRINGS.featuredTitle"
      >
        <div class="featured-card__eyebrow">{{ WIDGET_STRINGS.featuredTitle }}</div>
        <div v-for="link in featuredLinks" :key="link.url" class="featured-card__row">
          <span>{{ link.prefix }}</span>
          <a :href="link.url" target="_blank" rel="noopener noreferrer">{{ link.label }}</a>
        </div>
        <div v-if="parsedContent.verdict" class="featured-card__verdict">
          {{ parsedContent.verdict }}
        </div>
      </section>
      <ProviderAttribution
        v-if="showInlineProviders && message.role === 'agent' && message.providers?.length"
        :providers="message.providers"
      />
      <div class="message__meta">
        <span>{{ formatTime(message.timestamp) }}</span>
        <span
          v-if="message.status === 'sent'"
          class="message__sent"
          :aria-label="WIDGET_STRINGS.sentLabel"
        >
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d="m2.5 8.5 2.2 2.2 4-4.4M7.3 10.7l1.1 1.1 5.1-5.5" />
          </svg>
        </span>
      </div>
    </div>
  </article>
</template>
