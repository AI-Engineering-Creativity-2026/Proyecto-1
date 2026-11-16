function result(output) {
  const parsed = JSON.parse(output);
  if (!Array.isArray(parsed.messages) || !Array.isArray(parsed.calls)) return null;
  return parsed;
}

function answer(parsed) {
  return parsed?.messages.find((message) => message.type === "agent_message");
}

module.exports.recommendation = (output) => {
  const parsed = result(output);
  const message = answer(parsed);
  return Boolean(message &&
    parsed.calls.includes("orchestrator.recommend_movies") &&
    parsed.calls.includes("tmdb.search_movies") &&
    parsed.calls.includes("tmdb.get_movie_details") &&
    parsed.calls.includes("tmdb.get_recommendations") &&
    message.content.includes("Te recomiendo películas similares a The Matrix") &&
    message.providers?.includes("tmdb"));
};

module.exports.comparison = (output) => {
  const parsed = result(output);
  const message = answer(parsed);
  return Boolean(message &&
    parsed.calls.includes("orchestrator.compare_movie_with_book") &&
    parsed.calls.includes("books.search_books") &&
    parsed.calls.includes("books.get_book_details") &&
    message.content.includes("Premisa y acontecimientos centrales") &&
    message.content.includes("Personajes") &&
    message.content.includes("Temas y mensaje") &&
    message.content.includes("Adaptación al cine") &&
    message.content.includes("**Veredicto: Vale la pena verla.**") &&
    message.content.includes("análisis o comentario") &&
    message.providers?.includes("google_books"));
};

module.exports.capability = (output) => {
  const message = answer(result(output));
  return Boolean(message && /puedo comparar una película con su libro/i.test(message.content));
};

module.exports.poster = (output) => {
  const message = answer(result(output));
  return Boolean(message && Array.isArray(message.attachments) &&
    message.attachments.length > 0 &&
    message.attachments.every((attachment) => {
      const url = new URL(attachment.url);
      return attachment.type === "poster" &&
        url.protocol === "https:" && url.hostname === "image.tmdb.org" &&
        attachment.alt.length > 0;
    }));
};

module.exports.uiAction = (output, context) => {
  const parsed = result(output);
  const actions = parsed?.messages.filter((message) => message.type === "ui_action") ?? [];
  return actions.some((message) => message.action.source === context.config.source) && actions.every((message) => {
    const url = new URL(message.action.url);
    return message.action.kind === "open_url" && url.protocol === "https:" &&
      ((message.action.source === "imdb" && url.hostname === "www.imdb.com" &&
        /^\/title\/tt\d{7,10}\/$/.test(url.pathname)) ||
       (message.action.source === "google_books" && url.hostname === "books.google.com" &&
        url.pathname === "/books" && url.searchParams.has("id")));
  });
};

module.exports.refusal = (output) => {
  const parsed = result(output);
  const message = answer(parsed);
  return Boolean(message && parsed.calls.length === 0 && parsed.messages.length === 1 &&
    message.content.includes("Solo puedo ayudar con recomendaciones de películas o compararlas con libros"));
};
