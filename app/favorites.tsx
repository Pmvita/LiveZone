import { useCallback, useRef, useState } from "react";
import { Animated, FlatList, Image, Pressable, StyleSheet, Text, View } from "react-native";
import { Stack, useFocusEffect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { sportLabel } from "../lib/catalog";
import { formatKickoff } from "../lib/dates";
import {
  gameFavoriteKey,
  loadFavoriteGames,
  loadFavoriteTeams,
  removeFavoriteGame,
  removeFavoriteTeam,
  type FavoriteGame,
  type FavoriteTeam,
} from "../lib/favorites";
import { colors, fonts } from "../lib/theme";

type Row =
  | { key: string; kind: "section"; title: string; count: number }
  | { key: string; kind: "game"; game: FavoriteGame }
  | { key: string; kind: "team"; team: FavoriteTeam }
  | { key: string; kind: "empty"; copy: string };

function RemoveButton({ onPress, label }: { onPress: () => void; label: string }) {
  const scale = useRef(new Animated.Value(1)).current;

  return (
    <Pressable
      style={styles.remove}
      onPress={() => {
        Animated.sequence([
          Animated.spring(scale, { toValue: 0.92, friction: 5, tension: 200, useNativeDriver: true }),
          Animated.spring(scale, { toValue: 1, friction: 5, tension: 160, useNativeDriver: true }),
        ]).start();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Animated.Text style={[styles.removeText, { transform: [{ scale }] }]}>Remove</Animated.Text>
    </Pressable>
  );
}

export default function FavoritesScreen() {
  const [games, setGames] = useState<FavoriteGame[]>([]);
  const [teams, setTeams] = useState<FavoriteTeam[]>([]);
  const [ready, setReady] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      void (async () => {
        const [nextGames, nextTeams] = await Promise.all([loadFavoriteGames(), loadFavoriteTeams()]);
        if (!active) return;
        setGames(nextGames);
        setTeams(nextTeams);
        setReady(true);
      })();
      return () => {
        active = false;
      };
    }, []),
  );

  const rows: Row[] = [];
  rows.push({ key: "section-games", kind: "section", title: "Games", count: games.length });
  if (games.length === 0) {
    rows.push({ key: "empty-games", kind: "empty", copy: "Star a match on the scoreboard to save it here." });
  } else {
    for (const game of games) {
      rows.push({ key: `game-${gameFavoriteKey(game)}`, kind: "game", game });
    }
  }
  rows.push({ key: "section-teams", kind: "section", title: "Teams", count: teams.length });
  if (teams.length === 0) {
    rows.push({ key: "empty-teams", kind: "empty", copy: "Tap a team star on a match card to save the club." });
  } else {
    for (const team of teams) {
      rows.push({ key: `team-${team.id}`, kind: "team", team });
    }
  }

  return (
    <SafeAreaView style={styles.screen} edges={["top", "left", "right"]}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: "Favorites",
          headerStyle: { backgroundColor: colors.night },
          headerTintColor: colors.paper,
          headerTitleStyle: { fontFamily: fonts.uiBold, color: colors.paper },
        }}
      />
      <FlatList
        data={ready ? rows : []}
        keyExtractor={(item) => item.key}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.eyebrow}>Saved locally</Text>
            <View style={styles.brandRow}>
              <Text style={styles.brand}>LIVE</Text>
              <Text style={[styles.brand, styles.brandAccent]}>ZONE</Text>
            </View>
            <Text style={styles.title}>Favorites</Text>
            <Text style={styles.copy}>Starred matches and clubs stay on this device. Clear any item with Remove.</Text>
            <View style={styles.statRow}>
              <View style={styles.stat}>
                <Text style={styles.statValue}>{games.length}</Text>
                <Text style={styles.statLabel}>Games</Text>
              </View>
              <View style={styles.stat}>
                <Text style={styles.statValue}>{teams.length}</Text>
                <Text style={styles.statLabel}>Teams</Text>
              </View>
            </View>
          </View>
        }
        renderItem={({ item }) => {
          if (item.kind === "section") {
            return (
              <View style={styles.sectionRow}>
                <Text style={styles.section}>{item.title}</Text>
                <Text style={styles.sectionCount}>{item.count}</Text>
              </View>
            );
          }
          if (item.kind === "empty") {
            return <Text style={styles.empty}>{item.copy}</Text>;
          }
          if (item.kind === "team") {
            const { team } = item;
            return (
              <View style={styles.card}>
                <View style={styles.teamRow}>
                  {team.logo ? <Image source={{ uri: team.logo }} style={styles.logo} /> : <View style={styles.mark} />}
                  <View style={styles.metaCol}>
                    <Text style={styles.teamName}>{team.name}</Text>
                    <Text style={styles.meta}>{sportLabel(team.sport)}</Text>
                  </View>
                  <RemoveButton
                    label={`Remove ${team.name}`}
                    onPress={() => void removeFavoriteTeam(team.id).then(setTeams)}
                  />
                </View>
              </View>
            );
          }
          const { game } = item;
          return (
            <View style={styles.card}>
              <View style={styles.matchTop}>
                <Text style={styles.meta}>
                  {sportLabel(game.sport)} · {game.league}
                </Text>
                <Text style={styles.meta}>{formatKickoff(game.kickoff)}</Text>
              </View>
              <View style={styles.scoreLine}>
                <Text style={styles.side} numberOfLines={1}>
                  {game.home.name}
                </Text>
                <Text style={styles.scoreBlock}>
                  {game.homeScore ?? "–"} <Text style={styles.scoreSep}>–</Text> {game.awayScore ?? "–"}
                </Text>
                <Text style={[styles.side, styles.sideAway]} numberOfLines={1}>
                  {game.away.name}
                </Text>
              </View>
              <View style={styles.matchFooter}>
                <Text style={styles.status}>{game.statusLabel}</Text>
                <RemoveButton
                  label="Remove favorite game"
                  onPress={() => void removeFavoriteGame(gameFavoriteKey(game)).then(setGames)}
                />
              </View>
            </View>
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.night },
  list: { padding: 16, paddingBottom: 40 },
  header: {
    gap: 6,
    marginBottom: 14,
    borderTopWidth: 3,
    borderTopColor: colors.lime,
    paddingTop: 12,
  },
  eyebrow: {
    color: colors.mist,
    fontFamily: fonts.uiBold,
    fontSize: 11,
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  brandRow: { flexDirection: "row" },
  brand: {
    color: colors.paper,
    fontFamily: fonts.brand,
    fontSize: 34,
    letterSpacing: 1.2,
    lineHeight: 36,
  },
  brandAccent: { color: colors.lime },
  title: {
    color: colors.paper,
    fontFamily: fonts.uiExtra,
    fontSize: 22,
    marginTop: 4,
  },
  copy: { color: colors.mist, fontFamily: fonts.ui, lineHeight: 20 },
  statRow: { flexDirection: "row", gap: 8, marginTop: 10 },
  stat: {
    flex: 1,
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.panelBorder,
    borderLeftWidth: 3,
    borderLeftColor: colors.lime,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  statValue: {
    color: colors.lime,
    fontFamily: fonts.scoreBold,
    fontSize: 28,
    letterSpacing: 0.5,
  },
  statLabel: {
    color: colors.mist,
    fontFamily: fonts.uiBold,
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  sectionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 14,
    marginBottom: 8,
  },
  section: {
    color: colors.mist,
    fontFamily: fonts.uiBold,
    fontSize: 11,
    letterSpacing: 1.6,
    textTransform: "uppercase",
  },
  sectionCount: {
    color: colors.lime,
    fontFamily: fonts.scoreBold,
    fontSize: 14,
  },
  empty: {
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.panelBorderStrong,
    color: colors.mist,
    fontFamily: fonts.ui,
    padding: 16,
    marginBottom: 8,
  },
  card: {
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.panelBorder,
    borderLeftWidth: 3,
    borderLeftColor: colors.gold,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 6,
    gap: 6,
  },
  matchTop: { flexDirection: "row", justifyContent: "space-between", gap: 8 },
  scoreLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  side: {
    flex: 1,
    color: colors.paper,
    fontFamily: fonts.uiBold,
    fontSize: 15,
  },
  sideAway: { textAlign: "right" },
  scoreBlock: {
    color: colors.paper,
    fontFamily: fonts.scoreBold,
    fontSize: 22,
    letterSpacing: 0.5,
    minWidth: 72,
    textAlign: "center",
  },
  scoreSep: { color: colors.mist, fontSize: 16 },
  matchFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  status: {
    color: colors.lime,
    fontFamily: fonts.uiExtra,
    fontSize: 11,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  meta: { color: colors.mist, fontFamily: fonts.ui, fontSize: 12 },
  teamRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  metaCol: { flex: 1, gap: 2 },
  teamName: { color: colors.paper, fontFamily: fonts.uiBold, fontSize: 17 },
  logo: { width: 32, height: 32 },
  mark: { width: 32, height: 32, backgroundColor: colors.pitch },
  remove: {
    minHeight: 34,
    paddingHorizontal: 10,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,46,77,0.35)",
    backgroundColor: colors.sirenWash,
  },
  removeText: { color: colors.siren, fontFamily: fonts.uiBold, fontSize: 12 },
});
