import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  AppState,
  FlatList,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { apiUrl } from "../lib/api";
import { SPORTS, sportLabel, type SportId } from "../lib/catalog";
import { formatDay, formatKickoff, shiftDate, todayLocal } from "../lib/dates";
import { matchesTier, TIERS, type TierId } from "../lib/tiers";
import type { Game, GamesPayload, GameStatus } from "../lib/types";

/** Hits the local Expo routes only. Must stay at least 30 seconds. */
const POLL_MS = 30_000;

type Mode = "today" | "live";

type Row =
  | { key: string; kind: "header"; title: string }
  | { key: string; kind: "game"; game: Game };

function initials(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "•";
  if (parts.length === 1) return parts[0].slice(0, 3).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function TeamMark({ name, logo }: { name: string; logo: string | null }) {
  const [failed, setFailed] = useState(false);
  if (logo && !failed) {
    return <Image source={{ uri: logo }} style={styles.logo} onError={() => setFailed(true)} />;
  }
  return (
    <View style={styles.mark}>
      <Text style={styles.markText}>{initials(name)}</Text>
    </View>
  );
}

function TeamRow({ team, score }: { team: Game["home"]; score: number | null }) {
  return (
    <View style={styles.teamRow}>
      <TeamMark name={team.name} logo={team.logo} />
      <Text style={styles.teamName} numberOfLines={1}>
        {team.name}
      </Text>
      <Text style={[styles.score, score == null && styles.scorePending]}>{score == null ? "–" : String(score)}</Text>
    </View>
  );
}

function MatchCard({ game }: { game: Game }) {
  return (
    <View style={[styles.match, borderFor(game.status)]}>
      <View style={styles.matchTop}>
        <View style={[styles.badge, game.status === "live" && styles.badgeLive]}>
          {game.status === "live" ? <View style={styles.dot} /> : null}
          <Text style={[styles.badgeText, textFor(game.status)]}>{game.statusLabel}</Text>
        </View>
        <Text style={styles.kickoff}>{formatKickoff(game.kickoff)}</Text>
      </View>
      <TeamRow team={game.home} score={game.homeScore} />
      <TeamRow team={game.away} score={game.awayScore} />
    </View>
  );
}

function borderFor(status: GameStatus) {
  if (status === "live") return styles.matchLive;
  if (status === "scheduled") return styles.matchScheduled;
  if (status === "other") return styles.matchOther;
  return styles.matchFinished;
}

function textFor(status: GameStatus) {
  if (status === "live") return styles.badgeTextLive;
  if (status === "scheduled") return styles.badgeTextScheduled;
  if (status === "other") return styles.badgeTextOther;
  return styles.badgeTextFinished;
}

function emptyCopy(sport: SportId, tier: TierId, mode: Mode): string {
  const tierName = tier === "major" ? "major-league " : tier === "college" ? "college " : tier === "minor" ? "minor-league " : "";
  const sportName = sport === "all" ? "" : `${sportLabel(sport).toLowerCase()} `;
  const subject = `${tierName}${sportName}`.trim();
  if (!subject) {
    return mode === "live" ? "No matches are live right now." : "No matches on this date.";
  }
  return mode === "live" ? `No ${subject} games are live right now.` : `No ${subject} games on this date.`;
}

function groupRows(games: Game[]): Row[] {
  const groups = new Map<string, Game[]>();
  for (const game of games) {
    const label = [sportLabel(game.sport), game.country, game.league].filter(Boolean).join(" · ");
    const existing = groups.get(label);
    if (existing) existing.push(game);
    else groups.set(label, [game]);
  }

  const ordered = [...groups.entries()].sort((a, b) => {
    const aLive = a[1].some((game) => game.status === "live") ? 0 : 1;
    const bLive = b[1].some((game) => game.status === "live") ? 0 : 1;
    if (aLive !== bLive) return aLive - bLive;
    return a[0].localeCompare(b[0]);
  });

  const rows: Row[] = [];
  for (const [title, group] of ordered) {
    rows.push({ key: `header-${title}`, kind: "header", title });
    for (const game of group) rows.push({ key: `game-${game.sport}-${game.id}`, kind: "game", game });
  }
  return rows;
}

export function Scoreboard() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("today");
  const [sport, setSport] = useState<SportId>("all");
  const [tier, setTier] = useState<TierId>("all");
  const [date, setDate] = useState(todayLocal);
  const [data, setData] = useState<GamesPayload | null>(() => {
    if (typeof localStorage !== "undefined") {
      try {
        const raw = localStorage.getItem("livezone:last");
        return raw ? (JSON.parse(raw) as GamesPayload) : null;
      } catch {
        return null;
      }
    }
    return null;
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const requestId = useRef(0);

  const load = useCallback(
    async (silent = false) => {
      const id = ++requestId.current;
      if (!silent) {
        setLoading(true);
        setData(null);
        setError(null);
      }
      const params = new URLSearchParams({ sport });
      if (mode === "today") params.set("date", date);
      const path = mode === "live" ? `/api/live?${params}` : `/api/fixtures?${params}`;
      try {
        const response = await fetch(apiUrl(path));
        const body = (await response.json()) as GamesPayload & { error?: string };
        if (id !== requestId.current) return;
        if (!response.ok || !Array.isArray(body.games)) {
          setError(body.error || "Could not load games.");
          setLoading(false);
          return;
        }
        setData(body);
        setError(null);
        setLoading(false);
        if (typeof localStorage !== "undefined") {
          try {
            localStorage.setItem("livezone:last", JSON.stringify(body));
          } catch {
            // ignore
          }
        }
      } catch {
        if (id !== requestId.current) return;
        setError("Network error. Check that Expo is running.");
        setLoading(false);
      }
    },
    [mode, date, sport],
  );

  useEffect(() => {
    void load(false);
    const interval = setInterval(() => {
      if (AppState.currentState === "active") void load(true);
    }, POLL_MS);
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void load(true);
    });
    return () => {
      clearInterval(interval);
      subscription.remove();
    };
  }, [load]);

  const games = useMemo(() => (data?.games ?? []).filter((game) => matchesTier(game, tier)), [data, tier]);
  const rows = useMemo(() => groupRows(games), [games]);
  const liveCount = games.filter((game) => game.status === "live").length;
  const today = todayLocal();

  return (
    <SafeAreaView style={styles.screen} edges={["top", "left", "right"]}>
      <View style={styles.column}>
        <View style={styles.top}>
          <View>
            <Text style={styles.eyebrow}>Live scores</Text>
            <View style={styles.brandRow}>
              <Text style={styles.brand}>LIVE</Text>
              <Text style={[styles.brand, styles.brandAccent]}>ZONE</Text>
            </View>
            <View style={styles.navRow}>
              <Pressable onPress={() => router.push("/favorites")}>
                <Text style={styles.navLink}>Favorites</Text>
              </Pressable>
              <Pressable onPress={() => router.push("/settings")}>
                <Text style={styles.navLink}>Settings</Text>
              </Pressable>
            </View>
          </View>
          {liveCount > 0 ? (
            <View style={styles.liveCount}>
              <View style={styles.dotOnDark} />
              <Text style={styles.liveCountText}>{liveCount} LIVE</Text>
            </View>
          ) : data?.source === "demo" ? (
            <View style={styles.demoBadge}>
              <Text style={styles.demoBadgeText}>DEMO</Text>
            </View>
          ) : (
            <Text style={styles.eyebrow}>{mode === "live" ? "In progress" : formatDay(date)}</Text>
          )}
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.chipScroll}
          contentContainerStyle={styles.chips}
        >
          {SPORTS.map((item) => {
            const selected = sport === item.id;
            return (
              <Pressable
                key={item.id}
                onPress={() => setSport(item.id)}
                style={[styles.chip, selected && styles.chipSelected]}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                accessibilityLabel={`Show ${item.label}`}
              >
                <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{item.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.tierScroll}
          contentContainerStyle={styles.chips}
        >
          {TIERS.map((item) => {
            const selected = tier === item.id;
            return (
              <Pressable
                key={item.id}
                onPress={() => setTier(item.id)}
                style={[styles.chip, selected && styles.chipSelected]}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                accessibilityLabel={`Show ${item.label} leagues`}
              >
                <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{item.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <View style={styles.toolbar}>
          {mode === "today" ? (
            <View style={styles.dateNav}>
              <Pressable style={styles.control} onPress={() => setDate((current) => shiftDate(current, -1))} accessibilityLabel="Previous day">
                <Text style={styles.controlText}>Prev</Text>
              </Pressable>
              <Pressable
                style={[styles.control, date === today && styles.controlDisabled]}
                disabled={date === today}
                onPress={() => setDate(today)}
              >
                <Text style={styles.controlText}>Today</Text>
              </Pressable>
              <Pressable style={styles.control} onPress={() => setDate((current) => shiftDate(current, 1))} accessibilityLabel="Next day">
                <Text style={styles.controlText}>Next</Text>
              </Pressable>
            </View>
          ) : (
            <Text style={styles.dateLabel}>Matches in progress</Text>
          )}
          <View style={styles.segment}>
            <Pressable
              style={[styles.control, mode === "today" && styles.controlSelected]}
              onPress={() => setMode("today")}
              accessibilityRole="button"
              accessibilityState={{ selected: mode === "today" }}
            >
              <Text style={[styles.controlText, mode === "today" && styles.controlTextSelected]}>Scores</Text>
            </Pressable>
            <Pressable
              style={[styles.control, mode === "live" && styles.controlSelected]}
              onPress={() => setMode("live")}
              accessibilityRole="button"
              accessibilityState={{ selected: mode === "live" }}
            >
              <Text style={[styles.controlText, mode === "live" && styles.controlTextSelected]}>Live</Text>
            </Pressable>
          </View>
          {mode === "today" ? <Text style={styles.dateLabel}>{formatDay(date)}</Text> : null}
        </View>

        {data?.rateLimited ? (
          <Text style={styles.banner}>{data.message || "Live data paused to protect the API quota"}</Text>
        ) : data?.message && (data.source === "demo" || data.games.length === 0) ? (
          <Text style={styles.banner}>{data.message}</Text>
        ) : null}
        {error && data ? <Text style={styles.notice}>{error}</Text> : null}

        {loading && !data ? (
          <View style={styles.loadingBox} accessibilityRole="progressbar">
            <ActivityIndicator color="#d6ff3f" />
            <View style={styles.skeleton} />
            <View style={styles.skeleton} />
            <View style={styles.skeleton} />
          </View>
        ) : null}

        {!loading && error && !data ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
            <Pressable style={styles.retry} onPress={() => void load(false)}>
              <Text style={styles.retryText}>Retry</Text>
            </Pressable>
          </View>
        ) : null}

        {data ? (
          <FlatList
            data={rows}
            keyExtractor={(item) => item.key}
            style={styles.list}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              <Text style={styles.empty}>{emptyCopy(sport, tier, mode)}</Text>
            }
            ListFooterComponent={
              <Text style={styles.meta}>
                {games.length} {games.length === 1 ? "match" : "matches"}
                {" · "}
                {data.cached ? "Cached" : "Fresh"}
                {" · "}
                {data.source === "demo" ? "Demo" : "API-Sports"}
                {" · Updates every 30s"}
              </Text>
            }
            renderItem={({ item }) =>
              item.kind === "header" ? (
                <Text style={styles.league}>{item.title}</Text>
              ) : (
                <MatchCard game={item.game} />
              )
            }
          />
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#080a09",
  },
  column: {
    flex: 1,
    width: "100%",
    maxWidth: 720,
    alignSelf: "center",
  },
  top: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    borderTopWidth: 3,
    borderTopColor: "#d6ff3f",
    marginHorizontal: 16,
    marginTop: 8,
    paddingTop: 12,
  },
  eyebrow: {
    color: "#8d988f",
    fontSize: 12,
    letterSpacing: 1.6,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  brandRow: {
    flexDirection: "row",
  },
  brand: {
    color: "#f3f6f1",
    fontSize: 40,
    fontWeight: "800",
    letterSpacing: 1,
    lineHeight: 42,
  },
  brandAccent: {
    color: "#d6ff3f",
  },
  liveCount: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 6,
  },
  demoBadge: {
    backgroundColor: "#e6b35a",
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginBottom: 6,
  },
  demoBadgeText: {
    color: "#12180a",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.2,
  },
  liveCountText: {
    color: "#d6ff3f",
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 1.2,
  },
  navRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 6,
  },
  navLink: {
    color: "#9eb7c8",
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.6,
  },
  toolbar: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
    gap: 10,
  },
  dateNav: {
    flexDirection: "row",
  },
  segment: {
    flexDirection: "row",
  },
  control: {
    flex: 1,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(237,242,234,0.16)",
    marginRight: -1,
  },
  controlSelected: {
    backgroundColor: "#d6ff3f",
    borderColor: "#d6ff3f",
  },
  controlDisabled: {
    opacity: 0.4,
  },
  controlText: {
    color: "#f3f6f1",
    fontSize: 15,
    fontWeight: "700",
  },
  controlTextSelected: {
    color: "#12180a",
  },
  dateLabel: {
    color: "#8d988f",
    fontSize: 14,
    letterSpacing: 0.4,
  },
  chipScroll: {
    flexGrow: 0,
    marginTop: 14,
  },
  tierScroll: {
    flexGrow: 0,
    marginTop: 8,
  },
  chips: {
    paddingHorizontal: 16,
    gap: 8,
  },
  chip: {
    minHeight: 40,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(237,242,234,0.16)",
  },
  chipSelected: {
    backgroundColor: "#d6ff3f",
    borderColor: "#d6ff3f",
  },
  chipText: {
    color: "#f3f6f1",
    fontSize: 14,
    fontWeight: "700",
  },
  chipTextSelected: {
    color: "#12180a",
  },
  banner: {
    marginHorizontal: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "rgba(214,255,63,0.45)",
    backgroundColor: "rgba(214,255,63,0.08)",
    color: "#f3f6f1",
    padding: 12,
    lineHeight: 20,
  },
  notice: {
    marginHorizontal: 16,
    marginBottom: 10,
    color: "#e6b35a",
  },
  loadingBox: {
    paddingHorizontal: 16,
    gap: 8,
  },
  skeleton: {
    height: 108,
    backgroundColor: "#171c19",
  },
  errorBox: {
    marginHorizontal: 16,
    borderWidth: 1,
    borderColor: "rgba(255,176,162,0.5)",
    backgroundColor: "rgba(255,109,87,0.12)",
    padding: 14,
  },
  errorText: {
    color: "#ffb0a2",
    lineHeight: 20,
  },
  retry: {
    marginTop: 12,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f3f6f1",
  },
  retryText: {
    color: "#080a09",
    fontWeight: "800",
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  league: {
    color: "#8d988f",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1.4,
    textTransform: "uppercase",
    marginTop: 8,
    marginBottom: 8,
  },
  match: {
    backgroundColor: "#121614",
    borderWidth: 1,
    borderColor: "rgba(237,242,234,0.12)",
    borderLeftWidth: 3,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
  },
  matchLive: { borderLeftColor: "#d6ff3f" },
  matchScheduled: { borderLeftColor: "#9eb7c8" },
  matchFinished: { borderLeftColor: "transparent" },
  matchOther: { borderLeftColor: "#e6b35a" },
  matchTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  badgeLive: {
    backgroundColor: "#d6ff3f",
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  badgeTextLive: { color: "#12180a" },
  badgeTextScheduled: { color: "#9eb7c8" },
  badgeTextFinished: { color: "#8d988f" },
  badgeTextOther: { color: "#e6b35a" },
  kickoff: {
    color: "#8d988f",
    fontSize: 13,
  },
  teamRow: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 40,
    gap: 10,
  },
  teamName: {
    flex: 1,
    color: "#f3f6f1",
    fontSize: 22,
    fontWeight: "700",
  },
  score: {
    color: "#f3f6f1",
    fontSize: 32,
    fontWeight: "800",
    minWidth: 28,
    textAlign: "right",
  },
  scorePending: {
    color: "#8d988f",
  },
  logo: {
    width: 36,
    height: 36,
  },
  mark: {
    width: 36,
    height: 36,
    backgroundColor: "#1c231f",
    alignItems: "center",
    justifyContent: "center",
  },
  markText: {
    color: "#d6ff3f",
    fontSize: 13,
    fontWeight: "800",
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#12180a",
  },
  dotOnDark: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#d6ff3f",
  },
  empty: {
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "rgba(237,242,234,0.16)",
    color: "#8d988f",
    textAlign: "center",
    padding: 28,
  },
  meta: {
    color: "#8d988f",
    fontSize: 12,
    letterSpacing: 0.6,
    textTransform: "uppercase",
    marginTop: 8,
  },
});
