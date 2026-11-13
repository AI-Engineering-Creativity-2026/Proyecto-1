import { FormatRegistry, Type } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";

if (!FormatRegistry.Has("date-time")) {
  FormatRegistry.Set("date-time", (value) =>
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value) &&
    !Number.isNaN(Date.parse(value)),
  );
}

if (!FormatRegistry.Has("uri")) {
  FormatRegistry.Set("uri", (value) => {
    try {
      return new URL(value).protocol === "https:";
    } catch {
      return false;
    }
  });
}

export const OutgoingMessageSchema = Type.Object({
  type: Type.Literal("user_message"),
  conversationId: Type.String(),
  content: Type.String({ minLength: 1, maxLength: 2000 }),
  timestamp: Type.String({ format: "date-time" }),
});

export const AgentMessageSchema = Type.Object({
  type: Type.Literal("agent_message"),
  conversationId: Type.String(),
  content: Type.String({ minLength: 1 }),
  attachments: Type.Optional(
    Type.Array(
      Type.Object({
        type: Type.Literal("poster"),
        url: Type.String({ format: "uri" }),
        alt: Type.String(),
        title: Type.String(),
      }),
    ),
  ),
  providers: Type.Optional(
    Type.Array(
      Type.Union([Type.Literal("tmdb"), Type.Literal("google_books")]),
    ),
  ),
  timestamp: Type.String({ format: "date-time" }),
});

export const AgentTypingSchema = Type.Object({
  type: Type.Literal("agent_typing"),
  conversationId: Type.String(),
  timestamp: Type.String({ format: "date-time" }),
});

export const ErrorCodeSchema = Type.Union([
  Type.Literal("FORCED_ERROR"),
  Type.Literal("INVALID_MESSAGE"),
  Type.Literal("BLOCKED_INPUT"),
  Type.Literal("AGENT_TIMEOUT"),
  Type.Literal("AGENT_ERROR"),
  Type.Literal("UPSTREAM_ERROR"),
  Type.Literal("RATE_LIMITED"),
]);

export const ErrorMessageSchema = Type.Object({
  type: Type.Literal("error"),
  conversationId: Type.String(),
  error: Type.Object({
    code: ErrorCodeSchema,
    message: Type.String(),
  }),
  timestamp: Type.String({ format: "date-time" }),
});

export const UiActionSchema = Type.Object({
  type: Type.Literal("ui_action"),
  conversationId: Type.String(),
  timestamp: Type.String({ format: "date-time" }),
  action: Type.Object({
    kind: Type.Literal("open_url"),
    url: Type.String({ format: "uri" }),
    source: Type.Union([Type.Literal("imdb"), Type.Literal("google_books")]),
    reason: Type.Optional(Type.String()),
  }),
});

export const IncomingMessageSchema = Type.Union([
  AgentMessageSchema,
  AgentTypingSchema,
  ErrorMessageSchema,
  UiActionSchema,
]);

export const McpToolSchemas = {
  search_movies: Type.Object({
    query: Type.String({ minLength: 1 }),
    year: Type.Optional(Type.Integer()),
  }),
  get_movie_details: Type.Object({ movieId: Type.String({ minLength: 1 }) }),
  get_recommendations: Type.Object({ movieId: Type.String({ minLength: 1 }) }),
  search_books: Type.Object({
    title: Type.String({ minLength: 1 }),
    author: Type.Optional(Type.String()),
  }),
  get_book_details: Type.Object({ volumeId: Type.String({ minLength: 1 }) }),
} as const;

export interface MovieDetails {
  imdb_id: string | null;
  poster_url: string | null;
  overview: string;
  rating: number | null;
  genres: string[];
  year: number | null;
}

export interface BookDetails {
  volumeId: string;
  title: string;
  authors: string[];
  description: string;
}

export interface McpToolResponses {
  tmdb: {
    search_movies: { results: MovieDetails[] };
    get_movie_details: MovieDetails;
    get_recommendations: { results: MovieDetails[] };
  };
  books: {
    search_books: { results: BookDetails[] };
    get_book_details: BookDetails;
  };
}

export type ErrorCode = Type.Static<typeof ErrorCodeSchema>;
export type AgentMessage = Type.Static<typeof AgentMessageSchema>;
export type AgentTyping = Type.Static<typeof AgentTypingSchema>;
export type ErrorMessage = Type.Static<typeof ErrorMessageSchema>;
export type UiAction = Type.Static<typeof UiActionSchema>;
export type McpToolName = keyof typeof McpToolSchemas;

export type IncomingMessage =
  | AgentMessage
  | AgentTyping
  | ErrorMessage
  | UiAction;
export type OutgoingMessage = Type.Static<typeof OutgoingMessageSchema>;

export function isIncomingMessage(value: unknown): value is IncomingMessage {
  return Value.Check(IncomingMessageSchema, value);
}
