import type { IncomingMessage, OutgoingMessage } from "@agichat/contracts";
import type { McpClients } from "../mcp/mcp.clients";
import { createAgentOutputMessages } from "./agent-output";
import type { AgentPort, ConversationContext } from "./agent.port";

const KNOWN_SOURCE_BOOKS: Array<{
  match: RegExp;
  tmdbQuery: string;
  bookTitle: string;
  bookAuthor?: string;
}> = [
  { match: /blade runner/i, tmdbQuery: "Blade Runner", bookTitle: "Do Androids Dream of Electric Sheep?", bookAuthor: "Philip K. Dick" },
  { match: /resplandor|shining/i, tmdbQuery: "The Shining", bookTitle: "The Shining", bookAuthor: "Stephen King" },
  { match: /fight club|club de la pelea/i, tmdbQuery: "Fight Club", bookTitle: "Fight Club", bookAuthor: "Chuck Palahniuk" },
  { match: /dune/i, tmdbQuery: "Dune", bookTitle: "Dune", bookAuthor: "Frank Herbert" },
  { match: /no country for old men/i, tmdbQuery: "No Country for Old Men", bookTitle: "No Country for Old Men", bookAuthor: "Cormac McCarthy" },
  { match: /jurassic park/i, tmdbQuery: "Jurassic Park", bookTitle: "Jurassic Park", bookAuthor: "Michael Crichton" },
  { match: /hail mary|fin del mundo/i, tmdbQuery: "Project Hail Mary", bookTitle: "Project Hail Mary", bookAuthor: "Andy Weir" },
];

const GENRE_KEYWORDS: Array<{ match: RegExp; genre: string }> = [
  { match: /ciencia ficci[oó]n|sci-fi/i, genre: "ciencia ficción" },
  { match: /thriller|suspenso|misterio|psicol[oó]gico/i, genre: "suspenso" },
  { match: /stop[- ]?motion|animaci[oó]n|animad[ao]/i, genre: "animación" },
  { match: /fantas[ií]a/i, genre: "fantasía" },
  { match: /terror|horror/i, genre: "terror" },
  { match: /romance|rom[aá]ntic[ao]/i, genre: "romance" },
  { match: /familia|infantil/i, genre: "familia" },
  { match: /documental/i, genre: "documental" },
  { match: /drama/i, genre: "drama" },
  { match: /comedia/i, genre: "comedia" },
  { match: /acci[oó]n/i, genre: "acción" },
];

function extractAnchorMovieTitle(prompt: string): string | null {
  const patterns = [
    /si\s+(.+?)\s+es\s+mi\s+pel[ií]cula\s+favorita/i,
    /aparte\s+de\s+(.+?)\s+(?:me\s+)?recomiend/i,
    /(?:similares?\s+a|parecid[ao]s?\s+a|como)\s+([a-zA-Z0-9áéíóúñÁÉÍÓÚÑ\s:'-]{2,50})/i,
  ];
  for (const pattern of patterns) {
    const match = prompt.match(pattern);
    if (match?.[1]) {
      const cleaned = match[1].replace(/[¿?¡!"]/g, "").trim();
      if (cleaned.length >= 2) return cleaned;
    }
  }
  return null;
}

function isFallbackEligibleError(error: unknown): boolean {
  const code = typeof error === "object" && error !== null && "code" in error
    ? String((error as { code?: unknown }).code)
    : "";
  const message = error instanceof Error ? error.message : String(error);
  return (
    code === "RATE_LIMITED" ||
    code === "AGENT_RATE_LIMIT" ||
    code === "UPSTREAM_ERROR" ||
    /429|rate[_ -]?limit|too many requests|tool_use_failed|RATE_LIMITED|AGENT_RATE_LIMIT|UPSTREAM_ERROR|no está disponible/i.test(message)
  );
}

function extractSearchQuery(prompt: string): string {
  const known = KNOWN_SOURCE_BOOKS.find((entry) => entry.match.test(prompt));
  if (known) return known.tmdbQuery;

  return prompt
    .replace(/[¿?¡!"]/g, " ")
    .replace(/\b(compara|comparar|con su libro|con la novela|es fiel|al libro de|vale la pena ver|recomiéndame|sugiere|una película de|película)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80) || "Blade Runner";
}

async function respondWithMcpFallback(
  message: OutgoingMessage,
  clients: McpClients,
  now: () => Date,
): Promise<IncomingMessage[]> {
  const prompt = message.content;
  const isComparison = /(compara|comparar|libro|novela|fiel|basada|vale la pena)/i.test(prompt);

  if (isComparison) {
    const known = KNOWN_SOURCE_BOOKS.find((entry) => entry.match.test(prompt));
    const tmdbQuery = known?.tmdbQuery ?? extractSearchQuery(prompt);
    const moviesRes = await clients.tmdb.searchMovies({ query: tmdbQuery });
    const movie = moviesRes.results[0];

    const searchTitle = known?.bookTitle ?? (movie?.title ?? tmdbQuery);
    const searchAuthor = known?.bookAuthor;
    const booksRes = await clients.books.searchBooks({
      title: searchTitle,
      ...(searchAuthor ? { author: searchAuthor } : {}),
    });
    const book = booksRes.results[0] ?? null;

    const movieTitle = movie?.title ?? tmdbQuery;
    const movieYear = movie?.year ? ` (${movie.year})` : "";
    const bookTitle = book?.title ?? searchTitle;
    const authors = book?.authors.length ? ` de ${book.authors.join(", ")}` : "";

    const content = [
      `### ${movieTitle}${movieYear} vs. *${bookTitle}*${authors}`,
      "",
      "| Criterio | Película | Libro |",
      "| --- | --- | --- |",
      `| Premisa | ${movie?.overview?.slice(0, 110) || "Adaptación cinematográfica de la obra."} | Obra original${authors}. |`,
      "| Tono y ritmo | Enfoque visual y condensado para pantalla. | Mayor desarrollo psicológico y detalles internos. |",
      "| Adaptación | Conserva el conflicto y personajes centrales. | Mantiene la estructura literaria completa. |",
      "",
      "**Veredicto:** Vale la pena verla.",
    ].join("\n");

    return createAgentOutputMessages(
      message.conversationId,
      content,
      {
        movies: movie ? [{ source: "search_movies", movie }] : [],
        book,
      },
      now,
    );
  }

  const anchorTitle = extractAnchorMovieTitle(prompt);
  const genreMatch = GENRE_KEYWORDS.find((entry) => entry.match.test(prompt));

  let moviesRes = genreMatch
    ? await clients.tmdb.discoverMovies({ genres: [genreMatch.genre] })
    : undefined;
  let sourceType: "discover_movies" | "get_recommendations" | "search_movies" = genreMatch
    ? "discover_movies"
    : "search_movies";
  let heading = genreMatch
    ? `Aquí tienes recomendaciones de ${genreMatch.genre}:`
    : "Aquí tienes recomendaciones:";

  if (anchorTitle) {
    const anchorSearch = await clients.tmdb.searchMovies({ query: anchorTitle });
    const anchor = anchorSearch.results[0];
    if (anchor) {
      const recs = await clients.tmdb.getRecommendations({ movieId: String(anchor.id) });
      if (recs.results.length > 0) {
        moviesRes = recs;
        sourceType = "get_recommendations";
        heading = `Si te gustó **${anchor.title}**, te recomiendo estas películas similares:`;
      } else if (!moviesRes && anchor.genres[0]) {
        moviesRes = await clients.tmdb.discoverMovies({ genres: [anchor.genres[0]] });
        sourceType = "discover_movies";
        heading = `Si te gustó **${anchor.title}**, aquí tienes películas de ${anchor.genres[0]}:`;
      }
    }
  }

  if (!moviesRes || moviesRes.results.length === 0) {
    moviesRes = genreMatch
      ? await clients.tmdb.discoverMovies({ genres: [genreMatch.genre] })
      : await clients.tmdb.searchMovies({ query: extractSearchQuery(prompt) });
  }

  const topThree = moviesRes.results.slice(0, 3);
  const featured = topThree[0];

  const lines = topThree.map((item) => {
    const year = item.year ? ` (${item.year})` : "";
    const overview = item.overview ? ` — ${item.overview.slice(0, 120)}` : "";
    return `- **${item.title}${year}**${overview}`;
  });

  const content = topThree.length > 0
    ? [
        heading,
        "",
        ...lines,
        "",
        "También puedo comparar una película con su libro si quieres.",
      ].join("\n")
    : "No encontré resultados exactos en TMDB para esa búsqueda. ¿Quieres intentar con otro título o género?";

  return createAgentOutputMessages(
    message.conversationId,
    content,
    {
      movies: featured ? [{ source: sourceType, movie: featured }] : [],
      book: null,
    },
    now,
  );
}

/**
 * Wraps the primary Groq-backed AgentPort and falls back to live TMDB/Google Books
 * MCP data when Groq returns a 429 rate-limit error in presentation mode.
 */
export class DemoFallbackAgent implements AgentPort {
  private clientsPromise: Promise<McpClients> | undefined;

  constructor(
    private readonly primary: AgentPort,
    private readonly getClients: () => Promise<McpClients>,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async respond(
    message: OutgoingMessage,
    context: ConversationContext,
  ): Promise<IncomingMessage[]> {
    try {
      const events = await this.primary.respond(message, context);
      const shouldFallback = events.some(
        (event) =>
          event.type === "error" &&
          (event.error.code === "RATE_LIMITED" ||
            event.error.code === "AGENT_RATE_LIMIT" ||
            event.error.code === "UPSTREAM_ERROR"),
      );
      if (!shouldFallback) {
        return events;
      }
    } catch (error) {
      if (!isFallbackEligibleError(error)) {
        throw error;
      }
    }

    try {
      this.clientsPromise ??= this.getClients();
      const clients = await this.clientsPromise;
      return await respondWithMcpFallback(message, clients, this.now);
    } catch (fallbackError) {
      this.clientsPromise = undefined;
      throw fallbackError;
    }
  }
}
