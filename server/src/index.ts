import { Elysia } from "elysia";
import { createChatHandler } from "./handlers";
import { OutgoingMessageSchema } from "./schemas";

export function createApp() {
  const handler = createChatHandler();

  return new Elysia()
    .get("/", () => ({
      service: "agichat-mock-api",
      status: "ok",
    }))
    .ws("/ws", {
      body: OutgoingMessageSchema,
      message(ws, message) {
        const responses = handler.onOutgoingMessage(message);
        const [firstResponse, secondResponse] = responses;

        ws.send(JSON.stringify(firstResponse));

        if (secondResponse) {
          setTimeout(() => {
            ws.send(JSON.stringify(secondResponse));
          }, 750);
        }
      },
    });
}

if (import.meta.main) {
  const app = createApp().listen(3000);

  console.log(
    `AGIChat mock API listening at ${app.server?.hostname}:${app.server?.port}`
  );
}
