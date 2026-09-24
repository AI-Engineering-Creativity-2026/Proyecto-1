import { Elysia } from "elysia";
import { createChatHandler } from "./handlers";
import { OutgoingMessageSchema } from "./schemas";

export function createApp() {
  const handler = createChatHandler();

  return new Elysia()
    .get("/health", () => ({
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
    })
    .get("/", () => Bun.file(new URL("../public/index.html", import.meta.url)))
    .get("/*", ({ request, set }) => {
      const pathname = new URL(request.url).pathname;
      const relativePath = pathname.slice(1);

      if (!relativePath || relativePath.includes("..")) {
        set.status = 404;
        return "Not found";
      }

      return Bun.file(new URL(`../public/${relativePath}`, import.meta.url));
    });
}

if (import.meta.main) {
  const app = createApp().listen(3000);

  console.log(
    `AGIChat mock API listening at ${app.server?.hostname}:${app.server?.port}`
  );
}
