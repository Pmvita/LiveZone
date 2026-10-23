import type { GamesPayload } from "./types";

type Entry = {
  freshUntil: number;
  payload: GamesPayload;
};

type Store = {
  entries: Map<string, Entry>;
  inflight: Map<string, Promise<GamesPayload>>;
  budgetDay: string;
  budgetUsed: number;
  pausedUntil: number;
  upstreamKey: string | null;
};

const globalStore = globalThis as typeof globalThis & { __livezone?: Store };

export const DEFAULT_DAILY_LIMIT = 80;
const RATE_LIMIT_BACKOFF_MS = 15 * 60 * 1000;

function freshStore(): Store {
  return {
    entries: new Map(),
    inflight: new Map(),
    budgetDay: "",
    budgetUsed: 0,
    pausedUntil: 0,
    upstreamKey: null,
  };
}

function store(): Store {
  const existing = globalStore.__livezone;
  if (!existing?.entries || !existing.inflight) {
    globalStore.__livezone = freshStore();
  } else {
    if (typeof existing.budgetDay !== "string") existing.budgetDay = "";
    if (typeof existing.budgetUsed !== "number") existing.budgetUsed = 0;
    if (typeof existing.pausedUntil !== "number") existing.pausedUntil = 0;
    if (typeof existing.upstreamKey === "undefined") existing.upstreamKey = null;
  }
  return globalStore.__livezone as Store;
}

function utcDay(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

function budget(): Store {
  const current = store();
  const day = utcDay();
  if (current.budgetDay !== day) {
    current.budgetDay = day;
    current.budgetUsed = 0;
    current.pausedUntil = 0;
  }
  return current;
}

export function dailyLimit(): number {
  const raw = process.env.API_SPORTS_DAILY_LIMIT?.trim();
  if (!raw) return DEFAULT_DAILY_LIMIT;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 0) return DEFAULT_DAILY_LIMIT;
  return Math.floor(parsed);
}

export function canCallUpstream(): boolean {
  const current = budget();
  if (Date.now() < current.pausedUntil) return false;
  return current.budgetUsed < dailyLimit();
}

export function recordUpstreamCall(): void {
  const current = budget();
  current.budgetUsed += 1;
}

export function noteUpstreamRejection(daily: boolean): void {
  const current = budget();
  if (daily) {
    current.budgetUsed = Math.max(current.budgetUsed, dailyLimit());
    const next = new Date();
    next.setUTCDate(next.getUTCDate() + 1);
    next.setUTCHours(0, 0, 0, 0);
    current.pausedUntil = next.getTime();
    return;
  }
  current.pausedUntil = Math.max(current.pausedUntil, Date.now() + RATE_LIMIT_BACKOFF_MS);
}

export function peekInflight(key: string): Promise<GamesPayload> | null {
  return store().inflight.get(key) ?? null;
}

export function acquireUpstream(key: string): boolean {
  const current = store();
  if (current.upstreamKey && current.upstreamKey !== key) return false;
  current.upstreamKey = key;
  return true;
}

export function releaseUpstream(key: string): void {
  const current = store();
  if (current.upstreamKey === key) current.upstreamKey = null;
}

function clonePayload(payload: GamesPayload, cached: boolean): GamesPayload {
  return {
    ...payload,
    cached,
    games: payload.games.map((game) => ({
      ...game,
      home: { ...game.home },
      away: { ...game.away },
    })),
  };
}

export function cacheFreshUntil(key: string): number {
  return store().entries.get(key)?.freshUntil ?? 0;
}

export function readFresh(key: string): GamesPayload | null {
  const entry = store().entries.get(key);
  if (!entry) return null;
  if (Date.now() > entry.freshUntil) return null;
  return clonePayload(entry.payload, true);
}

export function readStale(key: string): GamesPayload | null {
  const entry = store().entries.get(key);
  if (!entry) return null;
  return clonePayload(entry.payload, true);
}

export function writeCache(key: string, payload: GamesPayload, ttlMs: number): void {
  store().entries.set(key, {
    freshUntil: Date.now() + ttlMs,
    payload: clonePayload(payload, false),
  });
}

export async function loadCached(
  key: string,
  ttlMs: number,
  loader: () => Promise<GamesPayload>,
): Promise<GamesPayload> {
  const fresh = readFresh(key);
  if (fresh) return fresh;

  const pending = store().inflight.get(key);
  if (pending) return pending;

  const promise = (async () => {
    const payload = await loader();
    writeCache(key, payload, ttlMs);
    return payload;
  })();

  store().inflight.set(key, promise);
  try {
    return await promise;
  } finally {
    if (store().inflight.get(key) === promise) store().inflight.delete(key);
  }
}
