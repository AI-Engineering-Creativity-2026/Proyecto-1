import type { IncomingMessage, OutgoingMessage } from "@agichat/contracts";
import type { AgentPort, ConversationContext } from "./agent.port";

export class MockAgent implements AgentPort {
  async respond(
    message: OutgoingMessage,
    _context: ConversationContext,
  ): Promise<IncomingMessage[]> {
    const timestamp = new Date().toISOString();

    if (message.content.includes("__force_error__")) {
      return [{
        type: "error",
        conversationId: message.conversationId,
        error: {
          code: "FORCED_ERROR",
          message: "No se pudo procesar el mensaje. Intenta de nuevo.",
        },
        timestamp,
      }];
    }

    const response: Extract<IncomingMessage, { type: "agent_message" }> = {
      type: "agent_message",
      conversationId: message.conversationId,
      content: `Recibí tu mensaje: **${message.content}**`,
      timestamp,
    };

    if (message.content.includes("__poster__")) {
      response.attachments = [{
        type: "poster",
        url: "https://image.tmdb.org/t/p/w500/mock-poster.jpg",
        alt: "Póster de película de prueba",
        title: "Película de prueba",
      }];
      response.providers = ["tmdb"];
    }

    const events: IncomingMessage[] = [{
      type: "agent_typing",
      conversationId: message.conversationId,
      timestamp,
    }];

    if (message.content.includes("__open_imdb__")) {
      events.push({
        type: "ui_action",
        conversationId: message.conversationId,
        timestamp,
        action: {
          kind: "open_url",
          url: "https://www.imdb.com/title/tt0000001/",
          source: "imdb",
          reason: "Enlace de prueba generado por MockAgent",
        },
      });
    }

    events.push(response);
    return events;
  }
}
