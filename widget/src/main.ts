import { init } from "./index";
import "./styles/preview.css";

const previewRoot = document.getElementById("app");

if (previewRoot) {
  init({
    containerId: previewRoot.id,
    apiUrl: "mock://widget-preview",
    conversationId: "widget-preview",
  });
}
