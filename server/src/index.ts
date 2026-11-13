import { Elysia } from "elysia";
import { Value } from "@sinclair/typebox/value";
import { createChatHandler, randomLatency } from "./handlers";
import { IncomingMessageSchema, OutgoingMessageSchema } from "./schemas";

interface AppOptions {
  latency?: () => number;
  allowedOrigins?: string[];
}

function genericError(conversationId: string) {
  return {
    type: "error" as const,
    conversationId,
    error: { code: "INTERNAL_ERROR", message: "No se pudo procesar el mensaje." },
    timestamp: new Date().toISOString(),
  };
}

export function createApp(options: AppOptions = {}) {
  const handler = createChatHandler();
  const latency = options.latency ?? randomLatency;

  return new Elysia()
    .get("/health", () => ({
      service: "agichat-mock-api",
      status: "ok",
    }))
    .ws("/ws", {
      beforeHandle({ request, set }) {
        const allowedOrigins = options.allowedOrigins ?? [];
        const origin = request.headers.get("origin");
        if (allowedOrigins.length > 0 && (!origin || !allowedOrigins.includes(origin))) {
          set.status = 403;
          return "Origin not allowed";
        }
      },
      body: OutgoingMessageSchema,
      message(ws, message) {
        const responses = handler.onOutgoingMessage(message);
        responses.forEach((response, index) => {
          const sendResponse = () => {
            if (!Value.Check(IncomingMessageSchema, response)) {
              console.error("Invalid outgoing WebSocket message", response);
              ws.send(JSON.stringify(genericError(message.conversationId)));
              return;
            }
            ws.send(JSON.stringify(response));
          };

          if (index === 0) sendResponse();
          else setTimeout(sendResponse, latency());
        });
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
  const port = Number(process.env.PORT ?? 3000);
  const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  const app = createApp({ allowedOrigins }).listen(port);

  console.log(
    `AGIChat mock API listening at ${app.server?.hostname}:${app.server?.port}`
  );
}
