import AsyncStorage from "@react-native-async-storage/async-storage";
import type { SportSlug } from "./catalog";
import type { Game, TeamSide } from "./types";

const GAMES_KEY = "livezone:favorites:games";
const TEAMS_KEY = "livezone:favorites:teams";

export type FavoriteGame = Game;

export type FavoriteTeam = {
  id: string;
  name: string;
  logo: string | null;
  sport: SportSlug;
};

export function gameFavoriteKey(game: Pick<Game, "sport" | "id">): string {
  return `${game.sport}:${game.id}`;
}

export function teamFavoriteKey(sport: SportSlug, name: string): string {
  return `${sport}:${name.trim().toLowerCase()}`;
}

export function teamFromSide(sport: SportSlug, team: TeamSide): FavoriteTeam {
  return {
    id: teamFavoriteKey(sport, team.name),
    name: team.name,
    logo: team.logo,
    sport,
  };
}

async function readJson<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

async function writeJson(key: string, value: unknown): Promise<void> {
  await AsyncStorage.setItem(key, JSON.stringify(value));
}

export async function loadFavoriteGames(): Promise<FavoriteGame[]> {
  return readJson<FavoriteGame[]>(GAMES_KEY, []);
}

export async function loadFavoriteTeams(): Promise<FavoriteTeam[]> {
  return readJson<FavoriteTeam[]>(TEAMS_KEY, []);
}

export async function saveFavoriteGames(games: FavoriteGame[]): Promise<void> {
  await writeJson(GAMES_KEY, games);
}

export async function saveFavoriteTeams(teams: FavoriteTeam[]): Promise<void> {
  await writeJson(TEAMS_KEY, teams);
}

export async function toggleFavoriteGame(game: Game): Promise<{ games: FavoriteGame[]; starred: boolean }> {
  const current = await loadFavoriteGames();
  const key = gameFavoriteKey(game);
  const index = current.findIndex((item) => gameFavoriteKey(item) === key);
  if (index >= 0) {
    const next = current.filter((_, i) => i !== index);
    await saveFavoriteGames(next);
    return { games: next, starred: false };
  }
  const next = [game, ...current.filter((item) => gameFavoriteKey(item) !== key)];
  await saveFavoriteGames(next);
  return { games: next, starred: true };
}

export async function toggleFavoriteTeam(team: FavoriteTeam): Promise<{ teams: FavoriteTeam[]; starred: boolean }> {
  const current = await loadFavoriteTeams();
  const index = current.findIndex((item) => item.id === team.id);
  if (index >= 0) {
    const next = current.filter((_, i) => i !== index);
    await saveFavoriteTeams(next);
    return { teams: next, starred: false };
  }
  const next = [team, ...current.filter((item) => item.id !== team.id)];
  await saveFavoriteTeams(next);
  return { teams: next, starred: true };
}

export async function removeFavoriteGame(key: string): Promise<FavoriteGame[]> {
  const next = (await loadFavoriteGames()).filter((item) => gameFavoriteKey(item) !== key);
  await saveFavoriteGames(next);
  return next;
}

export async function removeFavoriteTeam(id: string): Promise<FavoriteTeam[]> {
  const next = (await loadFavoriteTeams()).filter((item) => item.id !== id);
  await saveFavoriteTeams(next);
  return next;
}
