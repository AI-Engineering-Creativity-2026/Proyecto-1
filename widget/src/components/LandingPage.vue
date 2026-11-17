<script setup lang="ts">
import FilmCarousel from "./FilmCarousel.vue";
import SelmaClapperIcon from "./SelmaClapperIcon.vue";

defineEmits<{
  navigateChat: [];
}>();

const tmdbLogoUrl =
  "https://www.themoviedb.org/assets/2/v4/logos/v2/blue_square_2-d537fb228cf3ded904ef09b136fe3fec72548ebc1fea3fbbd1ad9e36364db38b.svg";
</script>

<template>
  <div class="landing-page">
    <header class="landing-nav">
      <a class="brand-wordmark" href="#/" aria-label="Selma, inicio">
        <SelmaClapperIcon />
        <span>Selma</span>
      </a>
      <nav class="landing-nav__links" aria-label="Navegación principal">
        <a href="#como-funciona">Cómo funciona</a>
        <a href="#peliculas">Películas</a>
        <a
          href="#/chat"
          class="landing-nav__cta"
          @click.prevent="$emit('navigateChat')"
        >
          Probar a Selma
        </a>
      </nav>
    </header>

    <main class="landing-main">
      <section class="landing-hero" aria-labelledby="landing-hero-title">
        <p class="landing-eyebrow">CINE Y LITERATURA</p>
        <h1 id="landing-hero-title">Si te gustó la película, descubre el libro.</h1>
        <p class="landing-hero__lead">
          Selma recomienda películas según tus gustos, te muestra su póster y compara cada adaptación con su libro original para ayudarte a decidir si vale la pena verla.
        </p>
        <div class="landing-hero__actions">
          <a
            href="#/chat"
            class="btn-primary"
            @click.prevent="$emit('navigateChat')"
          >
            Hablar con Selma
          </a>
        </div>
      </section>

      <FilmCarousel />

      <section id="como-funciona" class="landing-section" aria-labelledby="how-title">
        <p class="landing-eyebrow">CÓMO FUNCIONA</p>
        <h2 id="how-title">De una corazonada al veredicto en tres pasos</h2>
        <div class="steps-grid">
          <article class="step-card">
            <span class="step-card__num">01</span>
            <h3>Cuéntale qué te gusta</h3>
            <p>Pídele un género, una época o nombra una película que ya hayas disfrutado.</p>
          </article>
          <article class="step-card">
            <span class="step-card__num">02</span>
            <h3>Selma busca en TMDB y te muestra póster y enlaces</h3>
            <p>Consulta la ficha de la película, presenta su póster oficial y prepara el enlace a IMDb.</p>
          </article>
          <article class="step-card">
            <span class="step-card__num">03</span>
            <h3>Compárala con su libro y te dice si vale la pena</h3>
            <p>Contrasta la adaptación con la obra en Google Books y te da un veredicto claro.</p>
          </article>
        </div>
      </section>

      <section class="landing-section" aria-labelledby="capabilities-title">
        <p class="landing-eyebrow">QUÉ PUEDE HACER</p>
        <h2 id="capabilities-title">Pensada para amantes del cine y la lectura</h2>
        <ul class="capabilities-grid">
          <li class="capability-card">
            <h3>Recomendar por género</h3>
            <p>Sugerencias curadas en español según ciencia ficción, drama, suspenso o autores favoritos.</p>
          </li>
          <li class="capability-card">
            <h3>Mostrar póster</h3>
            <p>Visualiza el póster oficial de TMDB junto con el año de estreno.</p>
          </li>
          <li class="capability-card">
            <h3>Comparar película vs libro</h3>
            <p>Tabla compacta con tono, fidelidad, ritmo y un veredicto directo.</p>
          </li>
          <li class="capability-card">
            <h3>Abrir IMDb y Google Books en otra pestaña</h3>
            <p>Accesos verificados y seguros para seguir explorando la ficha o el libro.</p>
          </li>
        </ul>
      </section>
    </main>

    <footer class="landing-footer">
      <div class="landing-footer__providers">
        <div class="tmdb-credit">
          <img
            :src="tmdbLogoUrl"
            alt="Logo de The Movie Database (TMDB)"
            width="32"
            height="22"
            loading="lazy"
            decoding="async"
            referrerpolicy="no-referrer"
          >
          <span>This product uses the TMDB API but is not endorsed or certified by TMDB.</span>
        </div>
        <span class="books-credit">Powered by Google Books</span>
      </div>
      <p class="landing-footer__academic">
        Proyecto académico desarrollado para el curso CC3116 — Universidad del Valle de Guatemala (UVG).
      </p>
    </footer>
  </div>
</template>
