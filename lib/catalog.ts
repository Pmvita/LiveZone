export const SPORTS = [
  { id: "all", label: "All" },
  { id: "football", label: "Football" },
  { id: "basketball", label: "Basketball" },
  { id: "american-football", label: "American Football" },
] as const;

export type SportId = (typeof SPORTS)[number]["id"];
export type SportSlug = Exclude<SportId, "all">;

export const SPORT_SLUGS: SportSlug[] = ["football", "basketball", "american-football"];

export function sportLabel(sport: SportId): string {
  return SPORTS.find((item) => item.id === sport)?.label ?? "All";
}

export function parseSport(value: string | null): SportId | { error: string } {
  if (!value || value === "all") return "all";
  const match = SPORTS.find((item) => item.id === value);
  if (!match) return { error: "sport must be all, football, basketball, or american-football" };
  return match.id;
}
