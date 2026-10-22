import type { Game, GameStatus } from "./types";

const LIVE = new Set(["1H", "HT", "2H", "ET", "BT", "P", "LIVE", "INT", "SUSP", "Q1", "Q2", "Q3", "Q4", "OT"]);
const SCHEDULED = new Set(["TBD", "NS"]);
const FINISHED = new Set(["FT", "AET", "PEN", "AOT"]);

export function mapStatus(short: string): GameStatus {
  const code = short.toUpperCase();
  if (LIVE.has(code)) return "live";
  if (SCHEDULED.has(code)) return "scheduled";
  if (FINISHED.has(code)) return "finished";
  return "other";
}

export function statusLabel(short: string, elapsed: number | null, status: GameStatus): string {
  const code = short.toUpperCase();
  if (code === "HT") return "LIVE HT";
  if (code === "ET") return elapsed != null ? `LIVE ET ${elapsed}'` : "LIVE ET";
  if (code === "BT") return "LIVE BREAK";
  if (code === "P") return "LIVE PENS";
  if (code === "INT") return "INTERRUPTED";
  if (code === "SUSP") return "SUSPENDED";
  if (code === "Q1" || code === "Q2" || code === "Q3" || code === "Q4" || code === "OT") return `LIVE ${code}`;
  if (status === "live") return elapsed != null ? `LIVE ${elapsed}'` : "LIVE";
  if (code === "FT") return "FT";
  if (code === "AET") return "AET";
  if (code === "AOT") return "AOT";
  if (code === "PEN") return "PEN";
  if (code === "PST" || code === "POST") return "POSTPONED";
  if (code === "CANC") return "CANCELLED";
  if (code === "ABD") return "ABANDONED";
  if (code === "AWD") return "AWARDED";
  if (code === "WO") return "WALKOVER";
  if (code === "TBD") return "TIME TBD";
  if (status === "scheduled") return "SCHEDULED";
  return code || "—";
}

const STATUS_ORDER: Record<GameStatus, number> = {
  live: 0,
  scheduled: 1,
  other: 2,
  finished: 3,
};

export function compareGames(a: Game, b: Game): number {
  const statusDelta = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
  if (statusDelta !== 0) return statusDelta;
  return a.kickoff.localeCompare(b.kickoff);
}
