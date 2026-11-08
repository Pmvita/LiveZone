import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
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
import {
  gameFavoriteKey,
  loadFavoriteGames,
  loadFavoriteTeams,
  teamFavoriteKey,
  teamFromSide,
  toggleFavoriteGame,
  toggleFavoriteTeam,
} from "../lib/favorites";
import { loadPreferences } from "../lib/preferences";
import { matchesTier, TIERS, type TierId } from "../lib/tiers";
import { colors, fonts } from "../lib/theme";
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

function LivePulse({ dark }: { dark?: boolean }) {
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.35, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <Animated.View
      style={[
        styles.dot,
        dark ? styles.dotOnLime : styles.dotOnDark,
        { opacity: pulse, transform: [{ scale: pulse.interpolate({ inputRange: [0.35, 1], outputRange: [0.75, 1] }) }] },
      ]}
    />
  );
}

function StarButton({
  starred,
  onPress,
  label,
}: {
  starred: boolean;
  onPress: () => void;
  label: string;
}) {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePress = () => {
    Animated.sequence([
      Animated.spring(scale, { toValue: 1.35, friction: 4, tension: 220, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, friction: 5, tension: 160, useNativeDriver: true }),
    ]).start();
    onPress();
  };

  return (
    <Pressable onPress={handlePress} hitSlop={8} accessibilityRole="button" accessibilityLabel={label} style={styles.starHit}>
      <Animated.Text style={[styles.starGlyph, starred && styles.starGlyphOn, { transform: [{ scale }] }]}>
        {starred ? "★" : "☆"}
      </Animated.Text>
    </Pressable>
  );
}

function FilterChip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const scale = useRef(new Animated.Value(selected ? 1 : 0.96)).current;

  useEffect(() => {
    Animated.spring(scale, {
      toValue: selected ? 1 : 0.96,
      friction: 6,
      tension: 180,
      useNativeDriver: true,
    }).start();
  }, [selected, scale]);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={`Show ${label}`}
    >
      <Animated.View style={[styles.chip, selected && styles.chipSelected, { transform: [{ scale }] }]}>
        <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
      </Animated.View>
    </Pressable>
  );
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

function TeamRow({
  team,
  score,
  starred,
  onToggleTeam,
}: {
  team: Game["home"];
  score: number | null;
  starred: boolean;
  onToggleTeam: () => void;
}) {
  return (
    <View style={styles.teamRow}>
      <TeamMark name={team.name} logo={team.logo} />
      <Text style={styles.teamName} numberOfLines={1}>
        {team.name}
      </Text>
      <StarButton
        starred={starred}
        onPress={onToggleTeam}
        label={starred ? `Unstar ${team.name}` : `Star ${team.name}`}
      />
      <Text style={[styles.score, score == null && styles.scorePending]}>{score == null ? "–" : String(score)}</Text>
    </View>
  );
}

function MatchCard({
  game,
  gameStarred,
  homeStarred,
  awayStarred,
  onToggleGame,
  onToggleHome,
  onToggleAway,
}: {
  game: Game;
  gameStarred: boolean;
  homeStarred: boolean;
  awayStarred: boolean;
  onToggleGame: () => void;
  onToggleHome: () => void;
  onToggleAway: () => void;
}) {
  return (
    <View style={[styles.match, borderFor(game.status)]}>
      <View style={styles.matchTop}>
        <View style={[styles.badge, game.status === "live" && styles.badgeLive]}>
          {game.status === "live" ? <LivePulse dark /> : null}
          <Text style={[styles.badgeText, textFor(game.status)]}>{game.statusLabel}</Text>
        </View>
        <View style={styles.matchTopRight}>
          <Text style={styles.kickoff}>{formatKickoff(game.kickoff)}</Text>
          <StarButton
            starred={gameStarred}
            onPress={onToggleGame}
            label={gameStarred ? "Unstar match" : "Star match"}
          />
        </View>
      </View>
      <TeamRow team={game.home} score={game.homeScore} starred={homeStarred} onToggleTeam={onToggleHome} />
      <TeamRow team={game.away} score={game.awayScore} starred={awayStarred} onToggleTeam={onToggleAway} />
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
  const [favoriteGameKeys, setFavoriteGameKeys] = useState<Set<string>>(() => new Set());
  const [favoriteTeamKeys, setFavoriteTeamKeys] = useState<Set<string>>(() => new Set());
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

  useEffect(() => {
    void loadPreferences().then((prefs) => {
      setSport(prefs.preferredSport);
      setTier(prefs.preferredTier);
    });
    void Promise.all([loadFavoriteGames(), loadFavoriteTeams()]).then(([games, teams]) => {
      setFavoriteGameKeys(new Set(games.map(gameFavoriteKey)));
      setFavoriteTeamKeys(new Set(teams.map((team) => team.id)));
    });
  }, []);

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
            <View style={styles.brandLockup}>
              <Image source={require("../assets/livezone-mark.jpg")} style={styles.brandMark} />
              <View>
                <Text style={styles.eyebrow}>Live scores</Text>
                <View style={styles.brandRow}>
                  <Text style={styles.brand}>LIVE</Text>
                  <Text style={[styles.brand, styles.brandAccent]}>ZONE</Text>
                </View>
              </View>
            </View>
            <View style={styles.navRow}>
              <Pressable onPress={() => router.push("/favorites")} style={styles.navHit}>
                <Text style={styles.navLink}>Favorites</Text>
              </Pressable>
              <Pressable onPress={() => router.push("/settings")} style={styles.navHit}>
                <Text style={styles.navLink}>Settings</Text>
              </Pressable>
            </View>
          </View>
          {liveCount > 0 ? (
            <View style={styles.liveCount}>
              <LivePulse />
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
          {SPORTS.map((item) => (
            <FilterChip key={item.id} label={item.label} selected={sport === item.id} onPress={() => setSport(item.id)} />
          ))}
        </ScrollView>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.tierScroll}
          contentContainerStyle={styles.chips}
        >
          {TIERS.map((item) => (
            <FilterChip
              key={item.id}
              label={item.label}
              selected={tier === item.id}
              onPress={() => setTier(item.id)}
            />
          ))}
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
            <ActivityIndicator color={colors.lime} />
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
            ListEmptyComponent={<Text style={styles.empty}>{emptyCopy(sport, tier, mode)}</Text>}
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
                <MatchCard
                  game={item.game}
                  gameStarred={favoriteGameKeys.has(gameFavoriteKey(item.game))}
                  homeStarred={favoriteTeamKeys.has(teamFavoriteKey(item.game.sport, item.game.home.name))}
                  awayStarred={favoriteTeamKeys.has(teamFavoriteKey(item.game.sport, item.game.away.name))}
                  onToggleGame={() => {
                    void toggleFavoriteGame(item.game).then(({ games: next }) => {
                      setFavoriteGameKeys(new Set(next.map(gameFavoriteKey)));
                    });
                  }}
                  onToggleHome={() => {
                    void toggleFavoriteTeam(teamFromSide(item.game.sport, item.game.home)).then(({ teams }) => {
                      setFavoriteTeamKeys(new Set(teams.map((team) => team.id)));
                    });
                  }}
                  onToggleAway={() => {
                    void toggleFavoriteTeam(teamFromSide(item.game.sport, item.game.away)).then(({ teams }) => {
                      setFavoriteTeamKeys(new Set(teams.map((team) => team.id)));
                    });
                  }}
                />
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
    backgroundColor: colors.night,
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
    borderTopColor: colors.lime,
    marginHorizontal: 16,
    marginTop: 8,
    paddingTop: 12,
  },
  eyebrow: {
    color: colors.mist,
    fontFamily: fonts.uiBold,
    fontSize: 11,
    letterSpacing: 2,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  brandLockup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  brandMark: {
    width: 52,
    height: 52,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.panelBorderStrong,
  },
  brandRow: {
    flexDirection: "row",
  },
  brand: {
    color: colors.paper,
    fontFamily: fonts.brand,
    fontSize: 42,
    letterSpacing: 1.5,
    lineHeight: 44,
  },
  brandAccent: {
    color: colors.lime,
  },
  liveCount: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 6,
    backgroundColor: colors.limeWash,
    borderWidth: 1,
    borderColor: colors.limeEdge,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  demoBadge: {
    backgroundColor: colors.gold,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginBottom: 6,
  },
  demoBadgeText: {
    color: colors.ink,
    fontFamily: fonts.uiExtra,
    fontSize: 12,
    letterSpacing: 1.2,
  },
  liveCountText: {
    color: colors.lime,
    fontFamily: fonts.scoreBold,
    fontSize: 13,
    letterSpacing: 1.4,
  },
  navRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 8,
  },
  navHit: {
    paddingVertical: 4,
    paddingHorizontal: 2,
  },
  navLink: {
    color: colors.mist,
    fontFamily: fonts.uiBold,
    fontSize: 13,
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
    borderColor: colors.panelBorderStrong,
    backgroundColor: colors.pitch,
    marginRight: -1,
  },
  controlSelected: {
    backgroundColor: colors.lime,
    borderColor: colors.lime,
  },
  controlDisabled: {
    opacity: 0.4,
  },
  controlText: {
    color: colors.paper,
    fontFamily: fonts.uiBold,
    fontSize: 15,
  },
  controlTextSelected: {
    color: colors.ink,
  },
  dateLabel: {
    color: colors.mist,
    fontFamily: fonts.ui,
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
    borderColor: colors.panelBorderStrong,
    backgroundColor: colors.pitch,
  },
  chipSelected: {
    backgroundColor: colors.lime,
    borderColor: colors.lime,
  },
  chipText: {
    color: colors.paper,
    fontFamily: fonts.uiBold,
    fontSize: 14,
  },
  chipTextSelected: {
    color: colors.ink,
  },
  banner: {
    marginHorizontal: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.limeEdge,
    backgroundColor: colors.limeWash,
    color: colors.paper,
    fontFamily: fonts.ui,
    padding: 12,
    lineHeight: 20,
    overflow: "hidden",
  },
  notice: {
    marginHorizontal: 16,
    marginBottom: 10,
    color: colors.gold,
    fontFamily: fonts.uiBold,
  },
  loadingBox: {
    paddingHorizontal: 16,
    gap: 8,
  },
  skeleton: {
    height: 96,
    backgroundColor: colors.panel,
    borderLeftWidth: 3,
    borderLeftColor: colors.lime,
  },
  errorBox: {
    marginHorizontal: 16,
    borderWidth: 1,
    borderColor: "rgba(255,46,77,0.45)",
    backgroundColor: colors.sirenWash,
    padding: 14,
  },
  errorText: {
    color: colors.siren,
    fontFamily: fonts.ui,
    lineHeight: 20,
  },
  retry: {
    marginTop: 12,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.paper,
  },
  retryText: {
    color: colors.ink,
    fontFamily: fonts.uiExtra,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  league: {
    color: colors.mist,
    fontFamily: fonts.uiBold,
    fontSize: 11,
    letterSpacing: 1.6,
    textTransform: "uppercase",
    marginTop: 10,
    marginBottom: 6,
  },
  match: {
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.panelBorder,
    borderLeftWidth: 3,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 6,
  },
  matchLive: { borderLeftColor: colors.lime },
  matchScheduled: { borderLeftColor: colors.mist },
  matchFinished: { borderLeftColor: "transparent" },
  matchOther: { borderLeftColor: colors.gold },
  matchTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  badgeLive: {
    backgroundColor: colors.lime,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgeText: {
    fontFamily: fonts.uiExtra,
    fontSize: 11,
    letterSpacing: 1,
  },
  badgeTextLive: { color: colors.ink },
  badgeTextScheduled: { color: colors.mist },
  badgeTextFinished: { color: colors.mist },
  badgeTextOther: { color: colors.gold },
  kickoff: {
    color: colors.mist,
    fontFamily: fonts.ui,
    fontSize: 12,
  },
  matchTopRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  starHit: {
    minWidth: 28,
    minHeight: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  starGlyph: {
    color: colors.mist,
    fontSize: 20,
    fontWeight: "700",
  },
  starGlyphOn: {
    color: colors.gold,
  },
  teamRow: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 36,
    gap: 10,
  },
  teamName: {
    flex: 1,
    color: colors.paper,
    fontFamily: fonts.uiBold,
    fontSize: 18,
  },
  score: {
    color: colors.paper,
    fontFamily: fonts.scoreBold,
    fontSize: 30,
    minWidth: 30,
    textAlign: "right",
    letterSpacing: 0.5,
  },
  scorePending: {
    color: colors.mist,
  },
  logo: {
    width: 32,
    height: 32,
  },
  mark: {
    width: 32,
    height: 32,
    backgroundColor: colors.pitch,
    alignItems: "center",
    justifyContent: "center",
  },
  markText: {
    color: colors.lime,
    fontFamily: fonts.scoreBold,
    fontSize: 12,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dotOnDark: {
    backgroundColor: colors.lime,
  },
  dotOnLime: {
    backgroundColor: colors.ink,
  },
  empty: {
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.panelBorderStrong,
    color: colors.mist,
    fontFamily: fonts.ui,
    textAlign: "center",
    padding: 28,
  },
  meta: {
    color: colors.mist,
    fontFamily: fonts.uiBold,
    fontSize: 11,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginTop: 8,
  },
});
