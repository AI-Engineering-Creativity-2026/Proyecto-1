import "./index";
import "./styles/preview.css";

const containerId = "agichat-demo-widget";

export function mountDemo(
  apiUrl = import.meta.env.VITE_AGICHAT_API_URL ?? "ws://localhost:3000/ws",
): void {
  if (!document.getElementById(containerId)) return;

  window.AGIChat.init({
    containerId,
    apiUrl,
    conversationId: "agichat-demo",
  });
}

mountDemo();
