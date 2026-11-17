import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

export interface LandingFilmSeed {
  title: string;
  year: number;
  book: string;
  author: string;
}

export interface LandingFilmEntry extends LandingFilmSeed {
  tmdb_id: number | null;
  poster_path: string | null;
}

export const LANDING_FILM_SEEDS: LandingFilmSeed[] = [
  {
    title: "Blade Runner",
    year: 1982,
    book: "Do Androids Dream of Electric Sheep?",
    author: "Philip K. Dick",
  },
  {
    title: "Project Hail Mary",
    year: 2026,
    book: "Project Hail Mary",
    author: "Andy Weir",
  },
  {
    title: "Dune",
    year: 2021,
    book: "Dune",
    author: "Frank Herbert",
  },
  {
    title: "The Lord of the Rings: The Fellowship of the Ring",
    year: 2001,
    book: "The Lord of the Rings",
    author: "J. R. R. Tolkien",
  },
  {
    title: "Jurassic Park",
    year: 1993,
    book: "Jurassic Park",
    author: "Michael Crichton",
  },
  {
    title: "The Shining",
    year: 1980,
    book: "The Shining",
    author: "Stephen King",
  },
  {
    title: "Fight Club",
    year: 1999,
    book: "Fight Club",
    author: "Chuck Palahniuk",
  },
  {
    title: "No Country for Old Men",
    year: 2007,
    book: "No Country for Old Men",
    author: "Cormac McCarthy",
  },
];

const MAX_TMDB_CALLS = 12;
const LOG_PATH = "/tmp/llamadas-reales.log";
const OUTPUT_PATH = resolve(import.meta.dir, "../widget/src/data/landing-films.json");

interface TmdbSearchResponse {
  results?: Array<{
    id: number;
    title?: string;
    release_date?: string;
    poster_path?: string | null;
  }>;
}

async function fetchFilmPoster(
  seed: LandingFilmSeed,
  callIndex: number,
  token: string | undefined,
  apiKey: string | undefined,
): Promise<LandingFilmEntry> {
  if (callIndex > MAX_TMDB_CALLS) {
    throw new Error(`Hard cap exceeded: max ${MAX_TMDB_CALLS} TMDB calls allowed.`);
  }

  const url = new URL("https://api.themoviedb.org/3/search/movie");
  url.searchParams.set("query", seed.title);
  url.searchParams.set("year", String(seed.year));
  url.searchParams.set("include_adult", "false");
  url.searchParams.set("language", "es-MX");

  const headers: Record<string, string> = { Accept: "application/json" };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  } else if (apiKey) {
    url.searchParams.set("api_key", apiKey);
  }

  appendFileSync(
    LOG_PATH,
    `${new Date().toISOString()} | tmdb | call=${callIndex}/${MAX_TMDB_CALLS} | ${seed.title} (${seed.year})\n`,
  );

  const response = await fetch(url, { headers });
  if (!response.ok) {
    return { ...seed, tmdb_id: null, poster_path: null };
  }

  const payload = (await response.json()) as TmdbSearchResponse;
  const match =
    payload.results?.find((item) => item.poster_path) ??
    payload.results?.[0];

  return {
    ...seed,
    tmdb_id: match?.id ?? null,
    poster_path: match?.poster_path ?? null,
  };
}

async function main(): Promise<void> {
  if (!process.argv.includes("--confirmar-gasto")) {
    console.error("Uso: bun scripts/fetch-landing-posters.ts --confirmar-gasto");
    process.exit(1);
  }

  const token = process.env.TMDB_API_READ_ACCESS_TOKEN?.trim();
  const apiKey = process.env.TMDB_API_KEY?.trim();
  if (!token && !apiKey) {
    console.error("Falta TMDB_API_READ_ACCESS_TOKEN o TMDB_API_KEY en el entorno.");
    process.exit(1);
  }

  const entries: LandingFilmEntry[] = [];
  for (let i = 0; i < LANDING_FILM_SEEDS.length; i += 1) {
    const seed = LANDING_FILM_SEEDS[i]!;
    const entry = await fetchFilmPoster(seed, i + 1, token, apiKey);
    entries.push(entry);
    console.log(`${entry.title} (${entry.year}): tmdb_id=${entry.tmdb_id}, poster=${entry.poster_path ? "OK" : "NULL"}`);
  }

  mkdirSync(dirname(OUTPUT_PATH), { recursive: true });
  writeFileSync(OUTPUT_PATH, `${JSON.stringify(entries, null, 2)}\n`, "utf8");
  console.log(`Guardado ${entries.length} películas en ${OUTPUT_PATH}`);
}

if (import.meta.main) {
  await main();
}
