import { parseSport, SPORT_SLUGS, type SportId, type SportSlug } from "./catalog";
import { loadCached, readStale } from "./cache";
import { parseDateParam, todayLocal } from "./dates";
import { demoGamesFor, demoPayload } from "./mock";
import { compareGames, mapStatus, statusLabel } from "./status";
import type { Game, GamesPayload } from "./types";

export const LIVE_CACHE_MS = 25_000;
export const FIXTURES_CACHE_MS = 60_000;
const MAX_PAGES = 3;

const JSON_HEADERS = { "Cache-Control": "no-store" };

export class SportsError extends Error {
  status: number;

  constructor(message: string, status = 502) {
    super(message);
    this.name = "SportsError";
    this.status = status;
  }
}

type ApiSide = { name?: string; logo?: string | null; total?: number | null };
type ApiStatus = { short?: string; elapsed?: number | null; timer?: string | number | null };
type ApiRecord = {
  id?: number;
  date?: string | { date?: string; timestamp?: number };
  status?: ApiStatus;
  fixture?: { id?: number; date?: string; status?: ApiStatus };
  game?: { id?: number; date?: string | { date?: string; timestamp?: number }; status?: ApiStatus };
  league?: { name?: string; country?: string | { name?: string } };
  country?: { name?: string };
  teams?: { home?: ApiSide; away?: ApiSide };
  goals?: { home?: number | null; away?: number | null };
  scores?: { home?: number | ApiSide | null; away?: number | ApiSide | null };
};

function apiKey(): string {
  return process.env.API_SPORTS_KEY?.trim() ?? "";
}

const ENDPOINTS: Record<SportSlug, { base: string; resource: string }> = {
  football: { base: "https://v3.football.api-sports.io", resource: "fixtures" },
  basketball: { base: "https://v1.basketball.api-sports.io", resource: "games" },
  "american-football": { base: "https://v1.american-football.api-sports.io", resource: "games" },
};

function baseUrl(sport: SportSlug): string {
  const override = process.env.API_SPORTS_BASE_URL?.trim();
  if (sport === "football" && override) return override.replace(/\/$/, "");
  return ENDPOINTS[sport].base;
}

function hasErrors(errors: unknown): boolean {
  if (!errors) return false;
  if (Array.isArray(errors)) return errors.length > 0;
  if (typeof errors === "object") return Object.keys(errors).length > 0;
  return true;
}

function formatErrors(errors: unknown): string {
  if (Array.isArray(errors)) return errors.map(String).join("; ").slice(0, 300);
  if (errors && typeof errors === "object") {
    return Object.values(errors as Record<string, unknown>)
      .map(String)
      .join("; ")
      .slice(0, 300);
  }
  return String(errors).slice(0, 300);
}

function scoreValue(value: unknown): number | null {
  return typeof value === "number" ? value : null;
}

function countryName(item: ApiRecord): string {
  const leagueCountry = item.league?.country;
  if (typeof leagueCountry === "string") return leagueCountry;
  if (leagueCountry && typeof leagueCountry.name === "string") return leagueCountry.name;
  if (typeof item.country?.name === "string") return item.country.name;
  return "";
}

function readKickoff(item: ApiRecord): string {
  if (typeof item.fixture?.date === "string") return item.fixture.date;
  if (typeof item.date === "string") return item.date;
  const gameDate = item.game?.date;
  if (typeof gameDate === "string") return gameDate;
  if (gameDate && typeof gameDate.timestamp === "number") return new Date(gameDate.timestamp * 1000).toISOString();
  if (gameDate && typeof gameDate.date === "string") return gameDate.date;
  if (item.date && typeof item.date === "object" && typeof item.date.timestamp === "number") {
    return new Date(item.date.timestamp * 1000).toISOString();
  }
  return "";
}

function readTotal(value: number | ApiSide | null | undefined): number | null {
  if (typeof value === "number") return value;
  if (value && typeof value.total === "number") return value.total;
  return null;
}

function normalizeFixture(raw: unknown, sport: SportSlug): Game | null {
  if (!raw || typeof raw !== "object") return null;
  const item = raw as ApiRecord;
  const id = item.fixture?.id ?? item.game?.id ?? item.id;
  const home = item.teams?.home?.name;
  const away = item.teams?.away?.name;
  if (typeof id !== "number" || !home || !away) return null;

  const statusObj = item.fixture?.status ?? item.game?.status ?? item.status;
  const short = statusObj?.short ?? "";
  const status = mapStatus(short);
  const elapsed = typeof statusObj?.elapsed === "number" ? statusObj.elapsed : null;

  return {
    id,
    sport,
    league: item.league?.name || sportLabelFallback(sport),
    country: countryName(item),
    kickoff: readKickoff(item),
    status,
    statusShort: short || status,
    statusLabel: statusLabel(short, elapsed, status),
    elapsed,
    home: { name: home, logo: item.teams?.home?.logo || null },
    away: { name: away, logo: item.teams?.away?.logo || null },
    homeScore: scoreValue(item.goals?.home) ?? readTotal(item.scores?.home),
    awayScore: scoreValue(item.goals?.away) ?? readTotal(item.scores?.away),
  };
}

function sportLabelFallback(sport: SportSlug): string {
  if (sport === "basketball") return "Basketball";
  if (sport === "american-football") return "American Football";
  return "Football";
}

function apiPayload(date: string | null, sport: SportId, games: Game[]): GamesPayload {
  return {
    source: "api",
    cached: false,
    fetchedAt: new Date().toISOString(),
    date,
    sport,
    games: games.sort(compareGames),
  };
}

async function fetchPage(
  sport: SportSlug,
  params: Record<string, string>,
): Promise<{ games: Game[]; totalPages: number }> {
  const url = new URL(`${baseUrl(sport)}/${ENDPOINTS[sport].resource}`);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);

  let response: Response;
  try {
    response = await fetch(url, {
      headers: { "x-apisports-key": apiKey() },
      cache: "no-store",
      signal: AbortSignal.timeout(12_000),
    });
  } catch {
    throw new SportsError("Could not reach API-Sports.");
  }

  if (!response.ok) {
    throw new SportsError(`API-Sports returned HTTP ${response.status}.`);
  }

  let body: {
    errors?: unknown;
    response?: unknown;
    paging?: { total?: number };
  };
  try {
    body = await response.json();
  } catch {
    throw new SportsError("API-Sports returned a response that was not JSON.");
  }

  if (hasErrors(body.errors)) {
    const detail = formatErrors(body.errors);
    const limited = /request limit|rate limit|too many|quota/i.test(detail);
    throw new SportsError(
      limited ? "API-Sports daily request limit reached." : `API-Sports error: ${detail}`,
      limited ? 429 : 502,
    );
  }

  const list = Array.isArray(body.response) ? body.response : [];
  const games = list.map((item) => normalizeFixture(item, sport)).filter((game): game is Game => game !== null);
  const total = body.paging?.total;
  const totalPages = typeof total === "number" && total > 0 ? total : 1;
  return { games, totalPages };
}

async function fetchSportGames(sport: SportSlug, params: Record<string, string>): Promise<Game[]> {
  const first = await fetchPage(sport, params);
  const byId = new Map<string, Game>();
  for (const game of first.games) byId.set(`${game.sport}:${game.id}`, game);

  const lastPage = Math.min(first.totalPages, MAX_PAGES);
  for (let page = 2; page <= lastPage; page += 1) {
    const next = await fetchPage(sport, { ...params, page: String(page) });
    for (const game of next.games) byId.set(`${game.sport}:${game.id}`, game);
  }

  return [...byId.values()];
}

async function fetchSelected(sport: SportId, paramsFor: (slug: SportSlug) => Record<string, string>): Promise<Game[]> {
  const slugs = sport === "all" ? SPORT_SLUGS : [sport];
  const settled = await Promise.all(
    slugs.map(async (slug) => {
      try {
        return { slug, games: await fetchSportGames(slug, paramsFor(slug)) };
      } catch (error) {
        return { slug, error };
      }
    }),
  );

  const games: Game[] = [];
  const failures: unknown[] = [];
  for (const result of settled) {
    if ("games" in result && Array.isArray(result.games)) games.push(...result.games);
    else if ("error" in result) failures.push(result.error);
  }
  if (failures.length === slugs.length) {
    throw failures[0] instanceof Error ? failures[0] : new SportsError("Could not reach API-Sports.");
  }
  return games;
}

export async function getFixtures(date: string, sport: SportId): Promise<GamesPayload> {
  return loadCached(`fixtures:${date}:${sport}`, FIXTURES_CACHE_MS, async () => {
    if (!apiKey()) return demoPayload(date, demoGamesFor(date, sport), sport);
    return apiPayload(date, sport, await fetchSelected(sport, () => ({ date })));
  });
}

export async function getLive(sport: SportId): Promise<GamesPayload> {
  return loadCached(`live:${sport}`, LIVE_CACHE_MS, async () => {
    if (!apiKey()) {
      const date = todayLocal();
      return demoPayload(
        null,
        demoGamesFor(date, sport).filter((game) => game.status === "live"),
        sport,
      );
    }
    return apiPayload(null, sport, await fetchSelected(sport, () => ({ live: "all" })));
  });
}

export function resolveDate(value: string | null): string | { error: string } {
  return parseDateParam(value);
}

export function resolveSport(value: string | null): SportId | { error: string } {
  return parseSport(value);
}

export function failureResponse(cacheKey: string, error: unknown): Response {
  const stale = readStale(cacheKey);
  if (stale) {
    return Response.json(
      {
        ...stale,
        cached: true,
        message: "API-Sports is unavailable. Showing the last cached scores.",
      },
      { headers: JSON_HEADERS },
    );
  }

  const status = error instanceof SportsError ? error.status : 502;
  const message = error instanceof SportsError ? error.message : "Could not reach API-Sports.";
  return Response.json({ error: message }, { status, headers: JSON_HEADERS });
}

export function jsonResponse(body: GamesPayload): Response {
  return Response.json(body, { headers: JSON_HEADERS });
}
