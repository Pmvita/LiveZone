import { parseSport, SPORT_SLUGS, type SportId, type SportSlug } from "./catalog";
import {
  acquireUpstream,
  cacheFreshUntil,
  canCallUpstream,
  loadCached,
  noteUpstreamRejection,
  peekInflight,
  readFresh,
  readStale,
  recordUpstreamCall,
  releaseUpstream,
  writeCache,
} from "./cache";
import { parseDateParam, todayLocal } from "./dates";
import { demoGamesFor, demoPayload } from "./mock";
import { compareGames, mapStatus, statusLabel } from "./status";
import type { Game, GamesPayload } from "./types";

export const LIVE_CACHE_MS = 30_000;
export const FIXTURES_CACHE_MS = 60_000;
export const QUOTA_MESSAGE = "Live data paused to protect the API quota";
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
  league?: { id?: number; name?: string; country?: string | { name?: string } };
  country?: { name?: string };
  teams?: { home?: ApiSide; away?: ApiSide };
  goals?: { home?: number | null; away?: number | null };
  scores?: { home?: number | ApiSide | null; away?: number | ApiSide | null };
};

function apiKey(): string {
  return process.env.API_SPORTS_KEY?.trim() ?? "";
}

function strictMode(): boolean {
  return process.env.API_SPORTS_STRICT?.trim() === "1" || process.env.LIVEZONE_FAIL_HARD?.trim() === "1";
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

export function normalizeFixture(raw: unknown, sport: SportSlug): Game | null {
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
    leagueId: typeof item.league?.id === "number" ? item.league.id : null,
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

  if (response.status === 429) {
    let daily = false;
    try {
      daily = /day|daily|request limit/i.test(await response.text());
    } catch {
      daily = false;
    }
    noteUpstreamRejection(daily);
    throw new SportsError(daily ? "API-Sports daily request limit reached." : "API-Sports rate limit.", 429);
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
    if (limited) {
      noteUpstreamRejection(/day|daily|request limit/i.test(detail));
      throw new SportsError("API-Sports daily request limit reached.", 429);
    }
    throw new SportsError(`API-Sports error: ${detail}`);
  }

  const list = Array.isArray(body.response) ? body.response : [];
  const games = list.map((item) => normalizeFixture(item, sport)).filter((game): game is Game => game !== null);
  const total = body.paging?.total;
  const totalPages = typeof total === "number" && total > 0 ? total : 1;
  return { games, totalPages };
}

async function fetchPageCounted(
  sport: SportSlug,
  params: Record<string, string>,
): Promise<{ games: Game[]; totalPages: number }> {
  if (!canCallUpstream()) {
    throw new SportsError("API-Sports daily request limit reached.", 429);
  }
  recordUpstreamCall();
  return fetchPage(sport, params);
}

async function fetchSportGames(sport: SportSlug, params: Record<string, string>): Promise<Game[]> {
  const byId = new Map<string, Game>();
  let page = 1;
  let totalPages = 1;

  while (page <= totalPages && page <= MAX_PAGES) {
    if (page > 1 && !canCallUpstream()) break;
    let next: { games: Game[]; totalPages: number };
    try {
      next = await fetchPageCounted(sport, page === 1 ? params : { ...params, page: String(page) });
    } catch (error) {
      if (page > 1 && error instanceof SportsError && error.status === 429) break;
      throw error;
    }
    for (const game of next.games) byId.set(`${game.sport}:${game.id}`, game);
    totalPages = next.totalPages;
    page += 1;
  }

  return [...byId.values()];
}

function cacheKey(kind: "live" | "fixtures", slug: SportSlug, date: string | null): string {
  if (kind === "fixtures") return `fixtures:${date}:${slug}`;
  return slug === "football" ? `live:${slug}` : `live:${slug}:date`;
}

function liveParams(slug: SportSlug): Record<string, string> {
  if (slug === "football") return { live: "all" };
  return { date: todayLocal() };
}

function demoSlice(kind: "live" | "fixtures", slug: SportSlug, date: string | null): GamesPayload {
  const day = date || todayLocal();
  const games = demoGamesFor(day, slug).filter((game) => kind === "fixtures" || game.status === "live");
  return demoPayload(kind === "live" ? null : day, games, slug);
}

function quotaPayload(payload: GamesPayload): GamesPayload {
  return { ...payload, rateLimited: true, message: QUOTA_MESSAGE };
}

function emptySlice(kind: "live" | "fixtures", slug: SportSlug, date: string | null, message: string): GamesPayload {
  return {
    source: "api",
    cached: false,
    fetchedAt: new Date().toISOString(),
    date: kind === "live" ? null : date,
    sport: slug,
    games: [],
    message,
  };
}

function savedApiSlice(key: string): GamesPayload | null {
  const stale = readStale(key);
  if (!stale || stale.source !== "api") return null;
  return { ...stale, cached: true };
}

function fallbackSlice(key: string, kind: "live" | "fixtures", slug: SportSlug, date: string | null): GamesPayload {
  return savedApiSlice(key) ?? demoSlice(kind, slug, date);
}

async function fetchSlice(
  kind: "live" | "fixtures",
  slug: SportSlug,
  date: string | null,
  params: Record<string, string>,
): Promise<GamesPayload> {
  const key = cacheKey(kind, slug, date);
  try {
    const games = await fetchSportGames(slug, params);
    const visible = kind === "live" && !params.live ? games.filter((game) => game.status === "live") : games;
    const payload = apiPayload(kind === "live" ? null : date, slug, visible);
    return canCallUpstream() ? payload : quotaPayload(payload);
  } catch (error) {
    const limited = error instanceof SportsError && error.status === 429;
    const saved = savedApiSlice(key);
    if (saved) {
      return limited ? quotaPayload(saved) : { ...saved, message: "API-Sports is unavailable. Showing the last cached scores." };
    }
    if (!apiKey()) return quotaPayload(demoSlice(kind, slug, date));
    if (limited) return quotaPayload(demoSlice(kind, slug, date));
    if (strictMode()) {
      const message = error instanceof SportsError ? error.message : "Could not reach API-Sports.";
      return emptySlice(kind, slug, date, message);
    }
    const message = error instanceof SportsError ? error.message : "Could not reach API-Sports.";
    return emptySlice(kind, slug, date, message);
  }
}

async function loadOne(
  kind: "live" | "fixtures",
  slug: SportSlug,
  date: string | null,
  ttlMs: number,
  params: Record<string, string>,
  allowNewUpstream: boolean,
): Promise<GamesPayload> {
  const key = cacheKey(kind, slug, date);
  const fresh = readFresh(key);
  if (fresh && !(fresh.source === "demo" && apiKey())) return fresh;

  const pending = peekInflight(key);
  if (pending) return pending;

  if (!apiKey()) {
    const payload = demoSlice(kind, slug, date);
    writeCache(key, payload, ttlMs);
    return payload;
  }

  if (!canCallUpstream()) return quotaPayload(fallbackSlice(key, kind, slug, date));

  if (!allowNewUpstream || !acquireUpstream(key)) {
    const saved = savedApiSlice(key);
    if (saved) return saved;
    if (!apiKey()) return demoSlice(kind, slug, date);
    if (strictMode()) return emptySlice(kind, slug, date, "");
    return emptySlice(kind, slug, date, "");
  }

  try {
    return await loadCached(key, ttlMs, () => fetchSlice(kind, slug, date, params));
  } finally {
    releaseUpstream(key);
  }
}

function combine(sport: SportId, date: string | null, parts: GamesPayload[]): GamesPayload {
  const games = parts.flatMap((part) => part.games).sort(compareGames);
  const rateLimited = parts.some((part) => part.rateLimited === true);
  const source = parts.every((part) => part.source === "demo") ? "demo" : "api";
  const cached = parts.length > 0 && parts.every((part) => part.cached);
  const fetchedAt = parts.reduce(
    (latest, part) => (part.fetchedAt > latest ? part.fetchedAt : latest),
    parts[0]?.fetchedAt ?? new Date().toISOString(),
  );
  const message = rateLimited
    ? QUOTA_MESSAGE
    : source === "demo"
      ? parts.find((part) => part.message)?.message
      : games.length === 0
        ? parts.find((part) => part.message)?.message
        : undefined;
  return {
    source,
    cached,
    fetchedAt,
    date,
    sport,
    games,
    ...(rateLimited ? { rateLimited: true } : {}),
    ...(message ? { message } : {}),
  };
}

async function loadSelection(
  kind: "live" | "fixtures",
  sport: SportId,
  date: string | null,
  ttlMs: number,
  paramsFor: (slug: SportSlug) => Record<string, string>,
): Promise<GamesPayload> {
  const slugs = (sport === "all" ? [...SPORT_SLUGS] : [sport])
    .map((slug, index) => ({
      slug,
      index,
      freshUntil: cacheFreshUntil(cacheKey(kind, slug, date)),
    }))
    .sort((a, b) => a.freshUntil - b.freshUntil || a.index - b.index)
    .map((item) => item.slug);
  let upstreamClaimed = false;
  const parts: GamesPayload[] = [];

  for (const slug of slugs) {
    const key = cacheKey(kind, slug, date);
    const fresh = readFresh(key);
    const pending = fresh ? null : peekInflight(key);
    const canStart = !fresh && !pending && Boolean(apiKey()) && canCallUpstream() && !upstreamClaimed;
    if (canStart || pending) upstreamClaimed = true;
    parts.push(await loadOne(kind, slug, date, ttlMs, paramsFor(slug), canStart));
  }

  return combine(sport, kind === "live" ? null : date, parts);
}

export async function getFixtures(date: string, sport: SportId): Promise<GamesPayload> {
  if (sport !== "all") return loadSelection("fixtures", sport, date, FIXTURES_CACHE_MS, () => ({ date }));
  return loadCached(`v2:fixtures:${date}:all`, FIXTURES_CACHE_MS, () =>
    loadSelection("fixtures", sport, date, FIXTURES_CACHE_MS, () => ({ date })),
  );
}

export async function getLive(sport: SportId): Promise<GamesPayload> {
  if (sport !== "all") return loadSelection("live", sport, null, LIVE_CACHE_MS, liveParams);
  // v3 drops an older combined entry that mixed demo games into live scores.
  return loadCached("v3:live:all", LIVE_CACHE_MS, () => loadSelection("live", sport, null, LIVE_CACHE_MS, liveParams));
}

export function resolveDate(value: string | null): string | { error: string } {
  return parseDateParam(value);
}

export function resolveSport(value: string | null): SportId | { error: string } {
  return parseSport(value);
}

function relatedKeys(cacheKey: string): string[] {
  if (cacheKey === "live:all") return SPORT_SLUGS.map((slug) => `live:${slug}`);
  if (cacheKey.startsWith("fixtures:") && cacheKey.endsWith(":all")) {
    const date = cacheKey.slice("fixtures:".length, -":all".length);
    return SPORT_SLUGS.map((slug) => `fixtures:${date}:${slug}`);
  }
  return [cacheKey];
}

export function failureResponse(cacheKey: string, error: unknown): Response {
  const limited = error instanceof SportsError && error.status === 429;
  const staleParts = relatedKeys(cacheKey)
    .map((key) => readStale(key))
    .filter((payload): payload is GamesPayload => payload !== null);

  if (staleParts.length > 0) {
    const sport = cacheKey.endsWith(":all") ? "all" : staleParts[0].sport;
    const date = staleParts.find((part) => part.date)?.date ?? null;
    const body = combine(sport, date, staleParts);
    return jsonResponse(
      limited
        ? quotaPayload(body)
        : { ...body, message: "API-Sports is unavailable. Showing the last cached scores." },
    );
  }

  if (limited) {
    const sport = cacheKey.endsWith(":all") ? "all" : parseSport(cacheKey.split(":").at(-1) ?? null);
    const slug = typeof sport === "string" ? sport : "all";
    const date = cacheKey.startsWith("fixtures:") ? cacheKey.split(":")[1] : null;
    return jsonResponse(quotaPayload(demoPayload(date, demoGamesFor(date || todayLocal(), slug), slug)));
  }

  const status = error instanceof SportsError ? error.status : 502;
  const message = error instanceof SportsError ? error.message : "Could not reach API-Sports.";
  return Response.json({ error: message }, { status, headers: JSON_HEADERS });
}

export function jsonResponse(body: GamesPayload): Response {
  return Response.json(body, { headers: JSON_HEADERS });
}
