import "@fontsource/cormorant-garamond/300.css";
import "@fontsource/cormorant-garamond/300-italic.css";
import "@fontsource/cormorant-garamond/500-italic.css";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import { init } from "./index";
import "./styles/preview.css";

const previewRoot = document.getElementById("app");

if (previewRoot) {
  init({
    containerId: previewRoot.id,
    apiUrl: import.meta.env.VITE_AGICHAT_API_URL ?? "ws://localhost:3000/ws",
    conversationId: "widget-preview",
  });
}
