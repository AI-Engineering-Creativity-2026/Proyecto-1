import "@fontsource/cormorant-garamond/300.css";
import "@fontsource/cormorant-garamond/300-italic.css";
import "@fontsource/cormorant-garamond/500-italic.css";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import { createApp } from "vue";

import DemoRouter from "./components/DemoRouter.vue";
import "./index";
import "./styles/preview.css";

export function mountDemo(
  apiUrl = import.meta.env.VITE_AGICHAT_API_URL ?? "ws://localhost:3000/ws",
  targetSelector = "#agichat-demo-app",
): void {
  const target = document.querySelector(targetSelector);
  if (!target) return;
  createApp(DemoRouter, { apiUrl }).mount(target);
}

mountDemo();
