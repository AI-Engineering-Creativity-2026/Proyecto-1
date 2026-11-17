import "@fontsource/cormorant-garamond/300.css";
import "@fontsource/cormorant-garamond/300-italic.css";
import "@fontsource/cormorant-garamond/500-italic.css";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "./index";
import "./styles/preview.css";

const containerId = "agichat-demo-widget";

function updateLiveTime(): void {
  const el = document.getElementById("mook-live-time");
  if (!el) return;
  el.textContent = new Intl.DateTimeFormat("es", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  })
    .format(new Date())
    .toUpperCase();
}

function initEtherealFigureMotion(): void {
  if (typeof window.matchMedia !== "function") return;
  const root = document.documentElement;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  if (reducedMotion.matches) return;

  const isCoarsePointer = window.matchMedia("(pointer: coarse)").matches;
  let targetX = 0;
  let targetY = 0;
  let targetScale = 1;
  let currentX = 0;
  let currentY = 0;
  let currentScale = 1;
  let rafId = 0;
  let phase = 0;

  const applyVars = () => {
    root.style.setProperty("--mook-fig-x", `${currentX.toFixed(2)}px`);
    root.style.setProperty("--mook-fig-y", `${currentY.toFixed(2)}px`);
    root.style.setProperty("--mook-fig-scale", currentScale.toFixed(4));
    root.style.setProperty("--mook-streak-x", `${(currentX * 0.45).toFixed(2)}px`);
    root.style.setProperty("--mook-streak-y", `${(currentY * 0.45).toFixed(2)}px`);
    root.style.setProperty("--mook-grain-x", `${(currentX * 0.15).toFixed(2)}px`);
    root.style.setProperty("--mook-grain-y", `${(currentY * 0.15).toFixed(2)}px`);
  };

  const tick = () => {
    if (document.hidden || reducedMotion.matches) {
      rafId = 0;
      return;
    }

    if (isCoarsePointer) {
      phase += 0.015;
      targetX = Math.sin(phase) * 14;
      targetY = Math.cos(phase * 0.8) * 12;
      targetScale = 1.03;
    }

    currentX += (targetX - currentX) * 0.06;
    currentY += (targetY - currentY) * 0.06;
    currentScale += (targetScale - currentScale) * 0.06;
    applyVars();

    const settled =
      !isCoarsePointer &&
      Math.abs(targetX - currentX) < 0.15 &&
      Math.abs(targetY - currentY) < 0.15 &&
      Math.abs(targetScale - currentScale) < 0.001;

    if (!settled) {
      rafId = window.requestAnimationFrame(tick);
    } else {
      rafId = 0;
    }
  };

  const ensureLoop = () => {
    if (!rafId && !document.hidden && !reducedMotion.matches) {
      rafId = window.requestAnimationFrame(tick);
    }
  };

  if (!isCoarsePointer) {
    window.addEventListener(
      "pointermove",
      (event) => {
        const nx = (event.clientX / Math.max(window.innerWidth, 1) - 0.5) * 2;
        const ny = (event.clientY / Math.max(window.innerHeight, 1) - 0.5) * 2;
        targetX = nx * 48;
        targetY = ny * 36;
        targetScale = 1.08;
        ensureLoop();
      },
      { passive: true },
    );
  } else {
    ensureLoop();
  }

  document.addEventListener("visibilitychange", () => {
    if (document.hidden && rafId) {
      window.cancelAnimationFrame(rafId);
      rafId = 0;
    } else if (!document.hidden && isCoarsePointer) {
      ensureLoop();
    }
  });
}

export function mountDemo(
  apiUrl = import.meta.env.VITE_AGICHAT_API_URL ?? "ws://localhost:3000/ws",
): void {
  if (!document.getElementById(containerId)) return;

  updateLiveTime();
  window.setInterval(updateLiveTime, 30_000);
  initEtherealFigureMotion();

  window.AGIChat.init({
    containerId,
    apiUrl,
    conversationId: "agichat-demo",
    assistantName: "Selma",
    mode: "docked",
    theme: {
      primaryColor: "#ff4a1c",
    },
  });
}

mountDemo();
