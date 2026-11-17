import {
  isIncomingMessage,
  type IncomingMessage,
} from "@agichat/contracts";
import type { Static } from "@sinclair/typebox";
import { McpToolResponseSchemas } from "@agichat/contracts";
import type { MovieAgentEvidence } from "./movie.agent";

type BookDetails = Static<typeof McpToolResponseSchemas.books.get_book_details>;

export interface AgentPresentationEvidence {
  movies: readonly MovieAgentEvidence[];
  book?: BookDetails | null;
}

const SAFE_PRESENTATION_ERROR =
  "No se pudieron preparar los enlaces y adjuntos de forma segura. Intenta de nuevo.";
const MAX_PRESENTATION_ITEMS = 3;
const IMDB_ID_PATTERN = /^tt\d{7,10}$/;
const BOOK_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;

export function createAgentOutputMessages(
  conversationId: string,
  content: string,
  evidence: AgentPresentationEvidence,
  now: () => Date = () => new Date(),
): IncomingMessage[] {
  if (content.trim().length === 0 || !isSafeEvidence(evidence)) {
    return [createErrorMessage(conversationId, now)];
  }

  const movieEvidence = prioritizedMovies(evidence.movies);
  const attachments = createPosterAttachments(movieEvidence);
  const actions = createUiActions(conversationId, movieEvidence, evidence.book, now);
  const providers = [
    ...(movieEvidence.length > 0 ? ["tmdb" as const] : []),
    ...(evidence.book !== undefined && evidence.book !== null ? ["google_books" as const] : []),
  ];
  const agentMessage: IncomingMessage = {
    type: "agent_message",
    conversationId,
    content: content.trim(),
    ...(attachments.length > 0 ? { attachments } : {}),
    ...(providers.length > 0 ? { providers } : {}),
    timestamp: now().toISOString(),
  };
  if (!isIncomingMessage(agentMessage)) return [createErrorMessage(conversationId, now)];

  return [
    {
      type: "agent_typing",
      conversationId,
      timestamp: now().toISOString(),
    },
    agentMessage,
    ...actions,
  ];
}

function isSafeEvidence(evidence: AgentPresentationEvidence): boolean {
  if (!Array.isArray(evidence.movies)) return false;

  for (const item of evidence.movies) {
    if (item.movie.poster_url !== null && !isAllowedPosterUrl(item.movie.poster_url)) {
      return false;
    }
    if (item.movie.imdb_id !== null && !IMDB_ID_PATTERN.test(item.movie.imdb_id)) {
      return false;
    }
  }

  if (evidence.book !== undefined && evidence.book !== null) {
    return BOOK_ID_PATTERN.test(evidence.book.volumeId);
  }
  return true;
}

function prioritizedMovies(movies: readonly MovieAgentEvidence[]): MovieAgentEvidence[] {
  return [
    ...movies.filter((item) => item.source === "get_recommendations"),
    ...movies.filter((item) => item.source === "get_movie_details"),
    ...movies.filter((item) => item.source === "search_movies"),
  ].slice(0, MAX_PRESENTATION_ITEMS);
}

function createPosterAttachments(movies: readonly MovieAgentEvidence[]) {
  const seen = new Set<string>();
  const attachments = [];

  for (const { movie } of movies) {
    if (movie.poster_url === null || seen.has(movie.poster_url)) continue;
    seen.add(movie.poster_url);
    const yearText = movie.year === null ? "" : ` del año ${movie.year}`;
    attachments.push({
      type: "poster" as const,
      url: movie.poster_url,
      alt: `Póster de una película recomendada${yearText}.`,
      title: `Póster de película${movie.year === null ? "" : ` (${movie.year})`}`,
    });
  }

  return attachments;
}

function createUiActions(
  conversationId: string,
  movies: readonly MovieAgentEvidence[],
  book: BookDetails | null | undefined,
  now: () => Date,
): IncomingMessage[] {
  const imdbIds = [...new Set(
    movies
      .map(({ movie }) => movie.imdb_id)
      .filter((id): id is string => id !== null),
  )];
  const actions: IncomingMessage[] = imdbIds.map((imdbId) => ({
    type: "ui_action",
    conversationId,
    action: {
      kind: "open_url",
      url: `https://www.imdb.com/title/${imdbId}/`,
      source: "imdb",
      reason: "Abrir la ficha de la película en IMDb.",
    },
    timestamp: now().toISOString(),
  }));

  if (book !== undefined && book !== null) {
    const bookUrl = new URL("https://books.google.com/books");
    bookUrl.searchParams.set("id", book.volumeId);
    actions.push({
      type: "ui_action",
      conversationId,
      action: {
        kind: "open_url",
        url: bookUrl.toString(),
        source: "google_books",
        reason: "Abrir la ficha del libro en Google Books.",
      },
      timestamp: now().toISOString(),
    });
  }

  return actions.filter(isIncomingMessage);
}

function isAllowedPosterUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" &&
      url.hostname === "image.tmdb.org" &&
      url.port === "" &&
      url.username === "" &&
      url.password === "" &&
      /^\/t\/p\/(?:w\d+|original)\/[A-Za-z0-9._%-]+$/.test(url.pathname);
  } catch {
    return false;
  }
}

function createErrorMessage(
  conversationId: string,
  now: () => Date,
): IncomingMessage {
  return {
    type: "error",
    conversationId,
    error: { code: "AGENT_ERROR", message: SAFE_PRESENTATION_ERROR },
    timestamp: now().toISOString(),
  };
}
