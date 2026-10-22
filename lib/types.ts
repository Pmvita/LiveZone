import type { SportId, SportSlug } from "./catalog";

export type GameStatus = "live" | "scheduled" | "finished" | "other";

export type TeamSide = {
  name: string;
  logo: string | null;
};

export type Game = {
  id: number;
  sport: SportSlug;
  league: string;
  country: string;
  kickoff: string;
  status: GameStatus;
  statusShort: string;
  statusLabel: string;
  elapsed: number | null;
  home: TeamSide;
  away: TeamSide;
  homeScore: number | null;
  awayScore: number | null;
};

export type GamesPayload = {
  source: "api" | "demo";
  cached: boolean;
  fetchedAt: string;
  date: string | null;
  sport: SportId;
  games: Game[];
  message?: string;
};
