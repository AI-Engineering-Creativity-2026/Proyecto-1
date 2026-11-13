import { FormatRegistry, Type } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";

if (!FormatRegistry.Has("date-time")) {
  FormatRegistry.Set("date-time", (value) =>
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value) &&
    !Number.isNaN(Date.parse(value)),
  );
}

export const OutgoingMessageSchema = Type.Object({
  type: Type.Literal("user_message"),
  conversationId: Type.String(),
  content: Type.String({ minLength: 1 }),
  timestamp: Type.String({ format: "date-time" }),
});

export const IncomingMessageSchema = Type.Object({
  type: Type.Union([
    Type.Literal("agent_message"),
    Type.Literal("agent_typing"),
    Type.Literal("error"),
  ]),
  conversationId: Type.String(),
  content: Type.Optional(Type.String()),
  error: Type.Optional(
    Type.Object({
      code: Type.String(),
      message: Type.String(),
    }),
  ),
  timestamp: Type.String({ format: "date-time" }),
});

export type OutgoingMessage = Type.Static<typeof OutgoingMessageSchema>;
export type IncomingMessage = Type.Static<typeof IncomingMessageSchema>;

export function isIncomingMessage(value: unknown): value is IncomingMessage {
  return Value.Check(IncomingMessageSchema, value);
}
