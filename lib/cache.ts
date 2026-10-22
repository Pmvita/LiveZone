import type { GamesPayload } from "./types";

type Entry = {
  freshUntil: number;
  payload: GamesPayload;
};

type Store = {
  entries: Map<string, Entry>;
  inflight: Map<string, Promise<GamesPayload>>;
};

const globalStore = globalThis as typeof globalThis & { __livezone?: Store };

function store(): Store {
  if (!globalStore.__livezone) {
    globalStore.__livezone = {
      entries: new Map(),
      inflight: new Map(),
    };
  }
  return globalStore.__livezone;
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
    if (payload.source === "api") writeCache(key, payload, ttlMs);
    return payload;
  })();

  store().inflight.set(key, promise);
  try {
    return await promise;
  } finally {
    if (store().inflight.get(key) === promise) store().inflight.delete(key);
  }
}
