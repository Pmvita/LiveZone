import type { SportSlug } from "./catalog";
import type { Game } from "./types";

export const TIERS = [
  { id: "all", label: "All" },
  { id: "major", label: "Major" },
  { id: "college", label: "College" },
  { id: "minor", label: "Minor" },
] as const;

export type TierId = (typeof TIERS)[number]["id"];

const FOOTBALL_MAJOR_IDS = new Set([2, 39, 61, 78, 135, 140, 253]);
const BASKETBALL_MAJOR_IDS = new Set([12]);
const AMERICAN_FOOTBALL_MAJOR_IDS = new Set([1]);

function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isCollege(name: string): boolean {
  return /\b(ncaa|ncaab|ncaaf|college|collegiate|fbs|fcs)\b/.test(name);
}

function isMajor(sport: SportSlug, name: string, country: string, leagueId: number | null): boolean {
  if (sport === "football") {
    if (leagueId != null && FOOTBALL_MAJOR_IDS.has(leagueId)) return true;
    if (name === "uefa champions league" || name === "champions league") return true;
    if ((name === "mls" || name === "major league soccer") && !name.includes("next")) return true;
    if (name === "premier league" && /\b(england|united kingdom|great britain)\b/.test(country)) return true;
    if (name === "la liga" && /\bspain\b/.test(country)) return true;
    if (name === "serie a" && /\bitaly\b/.test(country)) return true;
    if (name === "bundesliga" && /\b(germany|deutschland)\b/.test(country)) return true;
    if (name === "ligue 1" && /\bfrance\b/.test(country)) return true;
    return false;
  }

  if (sport === "basketball") {
    if (/\bg league\b|\bgleague\b/.test(name)) return false;
    if (leagueId != null && BASKETBALL_MAJOR_IDS.has(leagueId)) return true;
    return name === "nba" || name === "national basketball association";
  }

  if (/\b(ufl|cfl|xfl|usfl)\b/.test(name)) return false;
  if (leagueId != null && AMERICAN_FOOTBALL_MAJOR_IDS.has(leagueId)) return true;
  return name === "nfl" || name === "national football league";
}

export function leagueTier(game: Pick<Game, "sport" | "league" | "country" | "leagueId">): Exclude<TierId, "all"> {
  const name = normalize(game.league);
  const country = normalize(game.country);
  if (isCollege(name)) return "college";
  const leagueId = typeof game.leagueId === "number" ? game.leagueId : null;
  if (isMajor(game.sport, name, country, leagueId)) return "major";
  return "minor";
}

export function matchesTier(game: Game, tier: TierId): boolean {
  if (tier === "all") return true;
  return leagueTier(game) === tier;
}
