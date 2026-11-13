import { describe, expect, it } from "bun:test";
import { Value } from "@sinclair/typebox/value";

import {
  IncomingMessageSchema,
  OutgoingMessageSchema,
} from "../src/index";

const timestamp = "2026-08-13T10:00:00.000Z";

describe("WebSocket contract v2", () => {
  it("accepts UI actions, poster attachments and providers", () => {
    expect(Value.Check(IncomingMessageSchema, {
      type: "ui_action",
      conversationId: "conversation-1",
      timestamp,
      action: {
        kind: "open_url",
        url: "https://www.imdb.com/title/tt0000001/",
        source: "imdb",
      },
    })).toBe(true);

    expect(Value.Check(IncomingMessageSchema, {
      type: "agent_message",
      conversationId: "conversation-1",
      timestamp,
      content: "Respuesta",
      attachments: [{
        type: "poster",
        url: "https://image.tmdb.org/t/p/w500/poster.jpg",
        alt: "Póster",
        title: "Película",
      }],
      providers: ["tmdb", "google_books"],
    })).toBe(true);
  });

  it("accepts only the enumerated error codes and caps user content", () => {
    expect(Value.Check(IncomingMessageSchema, {
      type: "error",
      conversationId: "conversation-1",
      timestamp,
      error: { code: "RATE_LIMITED", message: "Intenta más tarde." },
    })).toBe(true);

    expect(Value.Check(OutgoingMessageSchema, {
      type: "user_message",
      conversationId: "conversation-1",
      timestamp,
      content: "x".repeat(2001),
    })).toBe(false);
  });
});
