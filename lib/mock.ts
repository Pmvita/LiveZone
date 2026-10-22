import type { SportId } from "./catalog";
import { todayLocal } from "./dates";
import { compareGames } from "./status";
import type { Game, GamesPayload } from "./types";

export const DEMO_MESSAGE =
  "Demo slate. Add API_SPORTS_KEY to .env.local to load real scores. The key stays on the server and is never sent to the app.";

function at(date: string, hours: number, minutes: number): string {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(year, month - 1, day, hours, minutes, 0, 0).toISOString();
}

export function buildDemoGames(date: string): Game[] {
  const games: Game[] = [
    {
      id: 1001,
      sport: "football",
      league: "Premier League",
      country: "England",
      kickoff: at(date, 15, 0),
      status: "live",
      statusShort: "1H",
      statusLabel: "LIVE 34'",
      elapsed: 34,
      home: { name: "Arsenal", logo: null },
      away: { name: "Chelsea", logo: null },
      homeScore: 1,
      awayScore: 0,
    },
    {
      id: 1002,
      sport: "football",
      league: "Serie A",
      country: "Italy",
      kickoff: at(date, 14, 45),
      status: "live",
      statusShort: "HT",
      statusLabel: "LIVE HT",
      elapsed: 45,
      home: { name: "Inter", logo: null },
      away: { name: "AC Milan", logo: null },
      homeScore: 1,
      awayScore: 1,
    },
    {
      id: 1003,
      sport: "football",
      league: "Premier League",
      country: "England",
      kickoff: at(date, 17, 30),
      status: "scheduled",
      statusShort: "NS",
      statusLabel: "SCHEDULED",
      elapsed: null,
      home: { name: "Liverpool", logo: null },
      away: { name: "Everton", logo: null },
      homeScore: null,
      awayScore: null,
    },
    {
      id: 1004,
      sport: "football",
      league: "La Liga",
      country: "Spain",
      kickoff: at(date, 20, 0),
      status: "scheduled",
      statusShort: "NS",
      statusLabel: "SCHEDULED",
      elapsed: null,
      home: { name: "Real Madrid", logo: null },
      away: { name: "Sevilla", logo: null },
      homeScore: null,
      awayScore: null,
    },
    {
      id: 1005,
      sport: "football",
      league: "La Liga",
      country: "Spain",
      kickoff: at(date, 13, 0),
      status: "finished",
      statusShort: "FT",
      statusLabel: "FT",
      elapsed: 90,
      home: { name: "Barcelona", logo: null },
      away: { name: "Atletico Madrid", logo: null },
      homeScore: 2,
      awayScore: 2,
    },
    {
      id: 1006,
      sport: "football",
      league: "Serie A",
      country: "Italy",
      kickoff: at(date, 18, 45),
      status: "other",
      statusShort: "PST",
      statusLabel: "POSTPONED",
      elapsed: null,
      home: { name: "Napoli", logo: null },
      away: { name: "Juventus", logo: null },
      homeScore: null,
      awayScore: null,
    },
    {
      id: 2001,
      sport: "basketball",
      league: "NBA",
      country: "USA",
      kickoff: at(date, 19, 30),
      status: "live",
      statusShort: "Q2",
      statusLabel: "LIVE Q2",
      elapsed: null,
      home: { name: "Los Angeles Lakers", logo: null },
      away: { name: "Boston Celtics", logo: null },
      homeScore: 54,
      awayScore: 49,
    },
    {
      id: 2002,
      sport: "basketball",
      league: "NBA",
      country: "USA",
      kickoff: at(date, 22, 0),
      status: "scheduled",
      statusShort: "NS",
      statusLabel: "SCHEDULED",
      elapsed: null,
      home: { name: "Denver Nuggets", logo: null },
      away: { name: "Miami Heat", logo: null },
      homeScore: null,
      awayScore: null,
    },
    {
      id: 2003,
      sport: "basketball",
      league: "NBA",
      country: "USA",
      kickoff: at(date, 12, 30),
      status: "finished",
      statusShort: "FT",
      statusLabel: "FT",
      elapsed: null,
      home: { name: "Milwaukee Bucks", logo: null },
      away: { name: "New York Knicks", logo: null },
      homeScore: 118,
      awayScore: 112,
    },
    {
      id: 3001,
      sport: "american-football",
      league: "NFL",
      country: "USA",
      kickoff: at(date, 16, 25),
      status: "live",
      statusShort: "Q2",
      statusLabel: "LIVE Q2",
      elapsed: null,
      home: { name: "Kansas City Chiefs", logo: null },
      away: { name: "Buffalo Bills", logo: null },
      homeScore: 14,
      awayScore: 10,
    },
    {
      id: 3002,
      sport: "american-football",
      league: "NFL",
      country: "USA",
      kickoff: at(date, 20, 20),
      status: "scheduled",
      statusShort: "NS",
      statusLabel: "SCHEDULED",
      elapsed: null,
      home: { name: "Philadelphia Eagles", logo: null },
      away: { name: "Dallas Cowboys", logo: null },
      homeScore: null,
      awayScore: null,
    },
    {
      id: 3003,
      sport: "american-football",
      league: "NFL",
      country: "USA",
      kickoff: at(date, 13, 0),
      status: "finished",
      statusShort: "FT",
      statusLabel: "FT",
      elapsed: null,
      home: { name: "San Francisco 49ers", logo: null },
      away: { name: "Baltimore Ravens", logo: null },
      homeScore: 27,
      awayScore: 21,
    },
  ];

  return games.sort(compareGames);
}

export function demoGamesFor(date: string, sport: SportId): Game[] {
  const games = buildDemoGames(date);
  if (sport === "all") return games;
  return games.filter((game) => game.sport === sport);
}

export function demoPayload(date: string | null, games: Game[], sport: SportId): GamesPayload {
  return {
    source: "demo",
    cached: false,
    fetchedAt: new Date().toISOString(),
    date,
    sport,
    games,
    message: DEMO_MESSAGE,
  };
}

export function demoDate(date?: string | null): string {
  return date || todayLocal();
}
