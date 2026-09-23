import { init } from "./index";
import "./styles/preview.css";

const previewRoot = document.getElementById("app");

if (previewRoot) {
  init({
    containerId: previewRoot.id,
    apiUrl: "ws://localhost:3000/ws",
    conversationId: "widget-preview",
  });
}
