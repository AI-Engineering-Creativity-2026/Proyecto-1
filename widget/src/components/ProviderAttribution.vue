<script setup lang="ts">
import type { Message } from "@agichat/core";

const props = defineProps<{
  providers: Message["providers"];
}>();

const uniqueProviders = (): NonNullable<Message["providers"]> => [
  ...new Set(props.providers ?? []),
];

const tmdbLogoUrl =
  "https://www.themoviedb.org/assets/2/v4/logos/v2/blue_square_2-d537fb228cf3ded904ef09b136fe3fec72548ebc1fea3fbbd1ad9e36364db38b.svg";
const googleBooksLogoUrl = "https://books.google.com/googlebooks/images/poweredby.png";
</script>

<template>
  <section
    v-if="uniqueProviders().length > 0"
    class="provider-attributions"
    aria-label="Credits"
  >
    <div
      v-for="provider in uniqueProviders()"
      :key="provider"
      class="provider-attribution"
      :class="`provider-attribution--${provider}`"
    >
      <template v-if="provider === 'tmdb'">
        <a
          href="https://www.themoviedb.org/"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="The Movie Database (TMDB)"
        >
          <img
            :src="tmdbLogoUrl"
            alt="The Movie Database (TMDB) logo"
            width="42"
            height="30"
            loading="lazy"
            decoding="async"
            referrerpolicy="no-referrer"
          >
        </a>
        <p>This product uses the TMDB API but is not endorsed or certified by TMDB.</p>
      </template>

      <template v-else-if="provider === 'google_books'">
        <img
          :src="googleBooksLogoUrl"
          alt="Powered by Google"
          width="120"
          height="24"
          loading="lazy"
          decoding="async"
          referrerpolicy="no-referrer"
        >
        <a
          href="https://books.google.com/"
          target="_blank"
          rel="noopener noreferrer"
        >
          Google Books
        </a>
      </template>
    </div>
  </section>
</template>
