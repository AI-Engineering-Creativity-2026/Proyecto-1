import { Value } from "@sinclair/typebox/value";
import { McpToolResponseSchemas, type OutgoingMessage } from "@agichat/contracts";
import { ComparisonAgent, type ComparisonAssessment } from "../server/src/agents/comparison.agent";
import { MovieAgent } from "../server/src/agents/movie.agent";
import { OrchestratorAgent, type OrchestratorTools } from "../server/src/agents/orchestrator.agent";

async function fixture<T extends keyof typeof McpToolResponseSchemas>(
  provider: T,
  name: keyof (typeof McpToolResponseSchemas)[T] & string,
): Promise<unknown> {
  return Bun.file(new URL(`../server/tests/fixtures/mcp/${provider}/${name}.json`, import.meta.url)).json();
}

export async function runFunctionalCase(prompt: string) {
  const calls: string[] = [];
  const tmdb = {
    async searchMovies(input: { query: string }) {
      if (!input.query.trim()) throw new Error("Expected a movie query");
      calls.push("tmdb.search_movies");
      return Value.Parse(McpToolResponseSchemas.tmdb.search_movies, await fixture("tmdb", "search_movies"));
    },
    async getMovieDetails(input: { movieId: string }) {
      if (input.movieId !== "603") throw new Error("Unexpected movie ID");
      calls.push("tmdb.get_movie_details");
      return Value.Parse(McpToolResponseSchemas.tmdb.get_movie_details, await fixture("tmdb", "get_movie_details"));
    },
    async getRecommendations(input: { movieId: string }) {
      if (input.movieId !== "603") throw new Error("Unexpected recommendation ID");
      calls.push("tmdb.get_recommendations");
      return Value.Parse(McpToolResponseSchemas.tmdb.get_recommendations, await fixture("tmdb", "get_recommendations"));
    },
  };
  const books = {
    async searchBooks(input: { title: string }) {
      if (input.title !== "The Matrix") throw new Error("Unexpected book search title");
      calls.push("books.search_books");
      return Value.Parse(McpToolResponseSchemas.books.search_books, await fixture("books", "search_books"));
    },
    async getBookDetails(input: { volumeId: string }) {
      if (input.volumeId !== "zyTCAlFPjgYC") throw new Error("Unexpected book volume ID");
      calls.push("books.get_book_details");
      return Value.Parse(McpToolResponseSchemas.books.get_book_details, await fixture("books", "get_book_details"));
    },
  };
  const movieAgent = new MovieAgent(tmdb, async (_request, tools) => {
    const found = await tools.searchMovies({ query: "Matrix" });
    const movie = found.results[0];
    if (!movie) return "No encontré películas.";
    const details = await tools.getMovieDetails({ movieId: "603" });
    const recommendations = await tools.getRecommendations({ movieId: "603" });
    return `Te recomiendo películas similares a The Matrix: ${recommendations.results.length} opciones. ${details.overview}`;
  });
  const assessment: ComparisonAssessment = {
    relationship: "related_analysis",
    verdict: "worth_watching",
    evidence: {
      premise: { movie: "A computer hacker discovers that the world is a simulated reality.", book: "A collection of essays examining philosophical questions raised by The Matrix." },
      characters: { movie: "", book: "" },
      themes: { movie: "", book: "" },
      adaptation: { movie: "", book: "" },
    },
  };
  const comparisonAgent = new ComparisonAgent(books, async () => assessment);
  const tools: OrchestratorTools = {
    async recommendMovies({ request }) {
      calls.push("orchestrator.recommend_movies");
      const result = await movieAgent.runWithEvidence(request);
      return { content: result.content, movies: result.evidence };
    },
    async compareMovieWithBook(movie) {
      calls.push("orchestrator.compare_movie_with_book");
      const result = await comparisonAgent.runWithEvidence(movie);
      return { content: result.content, book: result.book };
    },
  };
  const agent = new OrchestratorAgent(tools, async (request, availableTools) => {
    if (/compar/i.test(request)) {
      const comparison = await availableTools.compareMovieWithBook({
        title: "The Matrix",
        overview: "A computer hacker discovers that the world is a simulated reality.",
        year: 1999,
        genres: ["Action", "Science Fiction"],
      });
      if (comparison.book?.volumeId) {
        availableTools.selectFeaturedItems?.({ bookVolumeId: comparison.book.volumeId });
      }
      return comparison.content;
    }
    const recommended = await availableTools.recommendMovies({ request });
    const imdbId = recommended.movies?.find((m) => m.movie.imdb_id !== null)?.movie.imdb_id;
    if (imdbId) availableTools.selectFeaturedItems?.({ imdbId });
    return recommended.content;
  }, () => new Date("2026-01-01T00:00:00.000Z"));
  const message: OutgoingMessage = {
    type: "user_message",
    conversationId: "functional-eval",
    content: prompt,
    timestamp: "2026-01-01T00:00:00.000Z",
  };
  const messages = await agent.respond(message, { conversationId: message.conversationId, history: [] });
  return { messages, calls };
}

if (import.meta.main) {
  const prompt = process.argv[2];
  if (!prompt) throw new Error("Expected a prompt argument");
  process.stdout.write(JSON.stringify(await runFunctionalCase(prompt)));
}
