<script lang="ts">
export default {
  shadowRoot: false,
};
</script>

<script setup lang="ts">
import { onMounted, onUnmounted, ref } from "vue";
import ChatPage from "./ChatPage.vue";
import EtherealBackground from "./EtherealBackground.vue";
import LandingPage from "./LandingPage.vue";

const props = withDefaults(
  defineProps<{
    apiUrl?: string;
  }>(),
  {
    apiUrl: import.meta.env.VITE_AGICHAT_API_URL ?? "ws://localhost:3000/ws",
  },
);

function resolveRoute(): "landing" | "chat" {
  if (typeof window === "undefined") return "landing";
  const hash = window.location.hash;
  const path = window.location.pathname;
  if (hash === "#/chat" || hash.startsWith("#/chat?") || path === "/chat") {
    return "chat";
  }
  return "landing";
}

const currentRoute = ref<"landing" | "chat">(resolveRoute());

function syncRoute(): void {
  currentRoute.value = resolveRoute();
}

function goToChat(): void {
  if (typeof window !== "undefined") {
    window.location.hash = "#/chat";
  }
  currentRoute.value = "chat";
}

function goToLanding(): void {
  if (typeof window !== "undefined") {
    if (window.location.pathname === "/chat") {
      window.history.pushState({}, "", "/");
    }
    window.location.hash = "#/";
  }
  currentRoute.value = "landing";
}

onMounted(() => {
  window.addEventListener("hashchange", syncRoute);
  window.addEventListener("popstate", syncRoute);
});

onUnmounted(() => {
  window.removeEventListener("hashchange", syncRoute);
  window.removeEventListener("popstate", syncRoute);
});
</script>

<template>
  <div class="app-shell">
    <EtherealBackground />
    <LandingPage v-if="currentRoute === 'landing'" @navigate-chat="goToChat" />
    <ChatPage v-else :api-url="props.apiUrl" @navigate-landing="goToLanding" />
  </div>
</template>
