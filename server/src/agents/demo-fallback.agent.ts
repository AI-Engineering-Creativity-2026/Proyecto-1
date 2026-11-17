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

function extractYearRange(prompt: string): { year_from: number; year_to: number; label?: string } | null {
  const decadeMatch = prompt.match(/(?:de\s+los\s+|años\s+|en\s+los\s+)?\b(60|70|80|90|2000|2010|2020)(?:'?s)?\b/i);
  if (decadeMatch?.[1]) {
    const raw = Number(decadeMatch[1]);
    const start = raw < 100 ? 1900 + raw : raw;
    return { year_from: start, year_to: start + 9, label: `de los ${start}` };
  }

  const exactYear = prompt.match(/\b(19[5-9]\d|20[0-2]\d)\b/);
  if (exactYear?.[1]) {
    const year = Number(exactYear[1]);
    return { year_from: year, year_to: year, label: `de ${year}` };
  }

  return null;
}

function truncateAtWord(text: string, maxLength: number): string {
  const clean = text.trim();
  if (clean.length <= maxLength) return clean;
  const sliced = clean.slice(0, maxLength);
  const lastSpace = sliced.lastIndexOf(" ");
  return `${(lastSpace > 40 ? sliced.slice(0, lastSpace) : sliced).trimEnd()}...`;
}

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
  const yearRange = extractYearRange(prompt);
  const discoverBase = {
    sort_by: "rating" as const,
    min_votes: yearRange ? 400 : 1500,
    ...(yearRange ? { year_from: yearRange.year_from, year_to: yearRange.year_to } : {}),
  };

  let moviesRes = genreMatch
    ? await clients.tmdb.discoverMovies({ genres: [genreMatch.genre], ...discoverBase })
    : undefined;
  let sourceType: "discover_movies" | "get_recommendations" | "search_movies" = genreMatch
    ? "discover_movies"
    : "search_movies";
  const periodSuffix = yearRange?.label ? ` ${yearRange.label}` : "";
  let heading = genreMatch
    ? `Aquí tienes recomendaciones de ${genreMatch.genre}${periodSuffix}:`
    : `Aquí tienes recomendaciones${periodSuffix}:`;

  if (anchorTitle) {
    try {
      const anchorSearch = await clients.tmdb.searchMovies({ query: anchorTitle });
      const anchor = anchorSearch.results[0];
      const anchorId = anchor?.imdb_id;
      if (anchorId && (/^\d{1,10}$/.test(anchorId) || /^tt\d{5,12}$/i.test(anchorId))) {
        try {
          const recs = await clients.tmdb.getRecommendations({ movieId: anchorId });
          const filtered = recs.results.filter(
            (item) => !(item.title ?? "").toLowerCase().includes(anchorTitle.toLowerCase()),
          );
          if (filtered.length > 0) {
            moviesRes = { results: filtered };
            sourceType = "get_recommendations";
            heading = `Si te gustó **${anchor?.title ?? anchorTitle}**, te recomiendo estas películas similares:`;
          }
        } catch {
          // Continue to details/genre discovery when recommendations lookup fails.
        }
      }

      let anchorGenres = anchor?.genres ?? [];
      if (anchorGenres.length === 0 && anchorId && (/^\d{1,10}$/.test(anchorId) || /^tt\d{5,12}$/i.test(anchorId))) {
        try {
          const details = await clients.tmdb.getMovieDetails({ movieId: anchorId });
          anchorGenres = details.genres;
        } catch {
          // Ignore details error and fall back to overview/keyword inference.
        }
      }

      const inferredGenre =
        anchorGenres[0] ??
        GENRE_KEYWORDS.find((entry) => entry.match.test(anchor?.overview ?? ""))?.genre ??
        (/otro mundo|m[aá]gic[oa]|fant[aá]stic[oa]|niñ[oa]/i.test(anchor?.overview ?? "") ? "fantasía" : undefined);

      if ((!moviesRes || moviesRes.results.length === 0) && inferredGenre) {
        const byGenre = await clients.tmdb.discoverMovies({ genres: [inferredGenre], ...discoverBase });
        const filtered = byGenre.results.filter(
          (item) => !(item.title ?? "").toLowerCase().includes(anchorTitle.toLowerCase()),
        );
        if (filtered.length > 0) {
          moviesRes = { results: filtered };
          sourceType = "discover_movies";
          heading = `Si te gustó **${anchor?.title ?? anchorTitle}**, aquí tienes películas de ${inferredGenre.toLowerCase()}:`;
        }
      }

      if (!moviesRes || moviesRes.results.length === 0) {
        const popular = await clients.tmdb.discoverMovies(discoverBase);
        const filtered = popular.results.filter(
          (item) => !(item.title ?? "").toLowerCase().includes(anchorTitle.toLowerCase()),
        );
        if (filtered.length > 0) {
          moviesRes = { results: filtered };
          sourceType = "discover_movies";
          heading = `Si te gustó **${anchor?.title ?? anchorTitle}**, te recomiendo estas opciones mejor valoradas:`;
        }
      }
    } catch {
      // Fall back to genre discovery or search below when anchor lookup fails.
    }
  }

  if (!moviesRes || moviesRes.results.length === 0) {
    moviesRes = genreMatch
      ? await clients.tmdb.discoverMovies({ genres: [genreMatch.genre], ...discoverBase })
      : await clients.tmdb.searchMovies({ query: anchorTitle ?? extractSearchQuery(prompt) });
  }

  const filteredResults = anchorTitle
    ? moviesRes.results.filter((item) => !(item.title ?? "").toLowerCase().includes(anchorTitle.toLowerCase()))
    : moviesRes.results;
  const topThree = (filteredResults.length > 0 ? filteredResults : moviesRes.results).slice(0, 3);
  const featured = topThree[0];

  const lines = topThree.map((item) => {
    const year = item.year ? ` (${item.year})` : "";
    const overview = item.overview ? ` — ${truncateAtWord(item.overview, 140)}` : "";
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
