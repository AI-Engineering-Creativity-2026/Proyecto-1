import { t } from "elysia";

export const OutgoingMessageSchema = t.Object({
  type: t.Literal("user_message"),
  conversationId: t.String(),
  content: t.String({ minLength: 1 }),
  timestamp: t.String({ format: "date-time" }),
});

export const IncomingMessageSchema = t.Object({
  type: t.Union([
    t.Literal("agent_message"),
    t.Literal("agent_typing"),
    t.Literal("error"),
  ]),
  conversationId: t.String(),
  content: t.Optional(t.String()),
  error: t.Optional(
    t.Object({
      code: t.String(),
      message: t.String(),
    })
  ),
  timestamp: t.String({ format: "date-time" }),
});

export type OutgoingMessage = typeof OutgoingMessageSchema.static;
export type IncomingMessage = typeof IncomingMessageSchema.static;
