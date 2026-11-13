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
