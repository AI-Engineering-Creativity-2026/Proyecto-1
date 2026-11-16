import type { IncomingMessage } from "@agichat/contracts";
import { runFunctionalCase } from "./run-functional-case";
import {
  validatedMessages,
  type EvalAdapter,
  type EvalObservation,
} from "./evaluation-runner";

export type EvalWebSocket = Pick<WebSocket, "addEventListener" | "send" | "close">;
export type EvalWebSocketFactory = (url: string) => EvalWebSocket;

export function createFakeEvalAdapter(): EvalAdapter {
  return {
    mode: "fake",
    async run(prompt): Promise<EvalObservation> {
      const result = await runFunctionalCase(prompt);
      return { messages: result.messages, toolCalls: result.calls };
    },
  };
}

export function createWebSocketEvalAdapter(
  url: string,
  timeoutMs = 90_000,
  socketFactory: EvalWebSocketFactory = (endpoint) => new WebSocket(endpoint),
): EvalAdapter {
  return {
    mode: "real",
    run: (prompt) => runWebSocketCase(prompt, url, timeoutMs, socketFactory),
  };
}

function runWebSocketCase(
  prompt: string,
  url: string,
  timeoutMs: number,
  socketFactory: EvalWebSocketFactory,
): Promise<EvalObservation> {
  return new Promise((resolve, reject) => {
    const conversationId = crypto.randomUUID();
    const socket = socketFactory(url);
    const messages: IncomingMessage[] = [];
    let settled = false;
    const timeout = setTimeout(() => finish(
      new Error("El servidor no respondió dentro del timeout del runner."),
    ), timeoutMs);

    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      socket.close();
      if (error) reject(error);
      else resolve({ messages });
    };

    socket.addEventListener("open", () => {
      try {
        socket.send(JSON.stringify({
          type: "user_message",
          conversationId,
          content: prompt,
          timestamp: new Date().toISOString(),
        }));
      } catch {
        finish(new Error("No se pudo enviar el caso al servidor de evaluación."));
      }
    }, { once: true });

    socket.addEventListener("message", (event) => {
      let payload: unknown;
      try {
        payload = JSON.parse(String(event.data));
      } catch {
        finish(new Error("El servidor devolvió un evento ilegible."));
        return;
      }
      let validMessages: IncomingMessage[];
      try {
        validMessages = validatedMessages([payload]);
      } catch (error: unknown) {
        finish(error instanceof Error ? error : new Error("El servidor devolvió un evento inválido."));
        return;
      }
      const message = validMessages[0];
      if (!message || message.conversationId !== conversationId) return;
      messages.push(message);
      if (message.type === "agent_message" || message.type === "error") finish();
    });

    socket.addEventListener("error", () => finish(
      new Error("No fue posible conectar con el WebSocket de evaluación."),
    ), { once: true });
    socket.addEventListener("close", () => {
      if (!settled) finish(new Error("El WebSocket cerró antes de completar el caso."));
    }, { once: true });
  });
}
