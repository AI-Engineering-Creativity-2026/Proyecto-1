<script setup lang="ts">
import { onMounted, onUnmounted, ref } from "vue";
import filmsData from "../data/landing-films.json";

export interface LandingFilm {
  tmdb_id: number | null;
  title: string;
  year: number;
  book: string;
  author: string;
  poster_path: string | null;
}

const films: LandingFilm[] = filmsData;
const activeIndex = ref(0);
const isHoverOrFocus = ref(false);
const prefersReducedMotion = ref(false);
const failedPosters = ref<Record<number, boolean>>({});
let touchStartX = 0;
let autoplayTimer: ReturnType<typeof setInterval> | null = null;

function posterUrl(path: string | null): string | null {
  if (!path) return null;
  return `https://image.tmdb.org/t/p/w342${path}`;
}

function next(): void {
  activeIndex.value = (activeIndex.value + 1) % films.length;
}

function prev(): void {
  activeIndex.value = (activeIndex.value - 1 + films.length) % films.length;
}

function goTo(index: number): void {
  if (index >= 0 && index < films.length) {
    activeIndex.value = index;
  }
}

function handleKeydown(event: KeyboardEvent): void {
  if (event.key === "ArrowRight") {
    event.preventDefault();
    next();
  } else if (event.key === "ArrowLeft") {
    event.preventDefault();
    prev();
  }
}

function handleTouchStart(event: TouchEvent): void {
  touchStartX = event.touches[0]?.clientX ?? 0;
}

function handleTouchEnd(event: TouchEvent): void {
  const endX = event.changedTouches[0]?.clientX ?? touchStartX;
  const delta = endX - touchStartX;
  if (Math.abs(delta) > 40) {
    if (delta < 0) next();
    else prev();
  }
}

function markPosterFailed(index: number): void {
  failedPosters.value[index] = true;
}

onMounted(() => {
  if (typeof window !== "undefined" && typeof window.matchMedia === "function") {
    prefersReducedMotion.value = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }
  autoplayTimer = window.setInterval(() => {
    if (!prefersReducedMotion.value && !isHoverOrFocus.value) {
      next();
    }
  }, 4500);
});

onUnmounted(() => {
  if (autoplayTimer !== null) {
    window.clearInterval(autoplayTimer);
  }
});
</script>

<template>
  <section
    id="peliculas"
    class="landing-carousel"
    role="region"
    aria-roledescription="carrusel"
    aria-label="Películas basadas en libros"
    tabindex="0"
    @keydown="handleKeydown"
    @mouseenter="isHoverOrFocus = true"
    @mouseleave="isHoverOrFocus = false"
    @focusin="isHoverOrFocus = true"
    @focusout="isHoverOrFocus = false"
    @touchstart.passive="handleTouchStart"
    @touchend.passive="handleTouchEnd"
  >
    <div class="landing-carousel__head">
      <div>
        <p class="landing-eyebrow">DEL LIBRO A LA PANTALLA</p>
        <h2>Historias que puedes comparar con Selma</h2>
      </div>
    </div>

    <div class="landing-carousel__viewport">
      <div
        class="landing-carousel__track"
        :style="{ transform: `translate3d(-${activeIndex * 100}%, 0, 0)` }"
      >
        <article
          v-for="(film, index) in films"
          :key="`${film.title}-${film.year}`"
          class="film-slide"
          :aria-hidden="index !== activeIndex"
        >
          <div class="film-slide__poster">
            <img
              v-if="posterUrl(film.poster_path) && !failedPosters[index]"
              :src="posterUrl(film.poster_path)!"
              :alt="`Póster de ${film.title} (${film.year})`"
              loading="lazy"
              decoding="async"
              referrerpolicy="no-referrer"
              @error="markPosterFailed(index)"
            >
            <div v-else class="film-slide__placeholder" role="img" :aria-label="film.title">
              <span>{{ film.title }}</span>
              <small>{{ film.year }}</small>
            </div>
          </div>
          <div class="film-slide__meta">
            <p class="film-slide__year">{{ film.year }}</p>
            <h3>{{ film.title }}</h3>
            <p class="film-slide__book">
              Basada en: <strong>{{ film.book }}</strong> de {{ film.author }}
            </p>
          </div>
        </article>
      </div>
    </div>

    <div class="landing-carousel__footer">
      <button
        type="button"
        class="carousel-btn"
        aria-label="Película anterior"
        @click="prev"
      >
        ←
      </button>

      <div class="landing-carousel__dots" role="tablist" aria-label="Seleccionar película">
        <button
          v-for="(film, index) in films"
          :key="`dot-${film.title}`"
          type="button"
          class="carousel-dot"
          :class="{ 'carousel-dot--active': index === activeIndex }"
          :aria-label="`Ir a ${film.title}`"
          :aria-current="index === activeIndex ? 'true' : undefined"
          @click="goTo(index)"
        ></button>
      </div>

      <button
        type="button"
        class="carousel-btn"
        aria-label="Siguiente película"
        @click="next"
      >
        →
      </button>
    </div>
  </section>
</template>
