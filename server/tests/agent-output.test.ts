import { describe, expect, it } from "bun:test";
import { createAgentOutputMessages } from "../src/agents/agent-output";
import type { MovieAgentEvidence } from "../src/agents/movie.agent";
import type { Static } from "@sinclair/typebox";
import { McpToolResponseSchemas } from "@agichat/contracts";

type BookDetails = Static<typeof McpToolResponseSchemas.books.get_book_details>;

const fixedNow = () => new Date("2026-11-14T10:00:01.000Z");
const movie: MovieAgentEvidence = {
  source: "get_movie_details",
  movie: {
    imdb_id: "tt0133093",
    poster_url: "https://image.tmdb.org/t/p/w500/matrix.jpg",
    overview: "A hacker discovers a simulated reality.",
    rating: 8.2,
    genres: ["Science Fiction"],
    year: 1999,
  },
};
const book: BookDetails = {
  volumeId: "book_id-1",
  title: "The Matrix and Philosophy",
  authors: ["William Irwin"],
  description: "A book about The Matrix.",
};

describe("agent output presentation", () => {
  it("builds links and posters from structured MCP evidence", () => {
    const messages = createAgentOutputMessages("conversation-1", "Recommendation", {
      movies: [movie],
      book,
    }, fixedNow);

    expect(messages).toHaveLength(4);
    expect(messages[1]).toMatchObject({
      type: "ui_action",
      action: { source: "imdb", url: "https://www.imdb.com/title/tt0133093/" },
    });
    expect(messages[2]).toMatchObject({
      type: "ui_action",
      action: { source: "google_books", url: "https://books.google.com/books?id=book_id-1" },
    });
    expect(messages[3]).toMatchObject({
      type: "agent_message",
      content: "Recommendation",
      providers: ["tmdb", "google_books"],
      attachments: [{ type: "poster", url: "https://image.tmdb.org/t/p/w500/matrix.jpg" }],
    });
  });

  it("does not turn model supplied URLs into actions or attachments", () => {
    const messages = createAgentOutputMessages(
      "conversation-1",
      "Open https://evil.example and use https://evil.example/poster.jpg",
      { movies: [] },
      fixedNow,
    );

    expect(messages).toHaveLength(2);
    expect(messages.some((message) => message.type === "ui_action")).toBe(false);
    expect(messages[1]).toMatchObject({
      type: "agent_message",
      content: "Open https://evil.example and use https://evil.example/poster.jpg",
    });
    if (messages[1]?.type === "agent_message") {
      expect(messages[1].attachments).toBeUndefined();
    }
  });

  it("returns a safe error when evidence contains an invalid ID or poster host", () => {
    const invalidMovie: MovieAgentEvidence = {
      ...movie,
      movie: { ...movie.movie, imdb_id: "https://evil.example/title", poster_url: "http://image.tmdb.org/poster.jpg" },
    };

    expect(createAgentOutputMessages("conversation-1", "Recommendation", {
      movies: [invalidMovie],
    }, fixedNow)).toMatchObject([{
      type: "error",
      error: { code: "AGENT_ERROR", message: "No se pudieron preparar los enlaces y adjuntos de forma segura. Intenta de nuevo." },
    }]);
    expect(createAgentOutputMessages("conversation-1", "Comparison", {
      movies: [],
      book: { ...book, volumeId: "../../evil" },
    }, fixedNow)).toMatchObject([{
      type: "error",
      error: { code: "AGENT_ERROR" },
    }]);
  });
});
