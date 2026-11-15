export interface ExternalLinkAction {
  kind: "open_url";
  url: string;
  source: "imdb" | "google_books";
  reason?: string;
}

export function isAllowedExternalLink(action: ExternalLinkAction): boolean {
  const expectedHost = action.source === "imdb"
    ? "www.imdb.com"
    : "books.google.com";

  try {
    const url = new URL(action.url);

    return (
      url.protocol === "https:" &&
      url.hostname === expectedHost &&
      url.port === "" &&
      url.username === "" &&
      url.password === ""
    );
  } catch {
    return false;
  }
}
