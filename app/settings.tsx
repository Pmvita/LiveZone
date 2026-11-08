import { useCallback, useEffect, useRef, useState } from "react";
import { Animated, Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Stack, useFocusEffect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { SPORTS, type SportId } from "../lib/catalog";
import { DEFAULT_PREFERENCES, loadPreferences, updatePreferences, type Preferences } from "../lib/preferences";
import { TIERS, type TierId } from "../lib/tiers";
import { colors, fonts } from "../lib/theme";

const brandMark = require("../assets/livezone-mark.jpg");

function SettingChip({
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
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityState={{ selected }}>
      <Animated.View style={[styles.chip, selected && styles.chipSelected, { transform: [{ scale }] }]}>
        <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
      </Animated.View>
    </Pressable>
  );
}

export default function SettingsScreen() {
  const [prefs, setPrefs] = useState<Preferences>(DEFAULT_PREFERENCES);
  const [ready, setReady] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      void loadPreferences().then((next) => {
        if (!active) return;
        setPrefs(next);
        setReady(true);
      });
      return () => {
        active = false;
      };
    }, []),
  );

  const setSport = (preferredSport: SportId) => {
    void updatePreferences({ preferredSport }).then(setPrefs);
  };

  const setTier = (preferredTier: TierId) => {
    void updatePreferences({ preferredTier }).then(setPrefs);
  };

  return (
    <SafeAreaView style={styles.screen} edges={["top", "left", "right"]}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: "Settings",
          headerStyle: { backgroundColor: colors.night },
          headerTintColor: colors.paper,
          headerTitleStyle: { fontFamily: fonts.uiBold, color: colors.paper },
        }}
      />
      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.header}>
          <View style={styles.brandLockup}>
            <Image source={brandMark} style={styles.brandMark} />
            <View>
              <Text style={styles.eyebrow}>Preferences</Text>
              <View style={styles.brandRow}>
                <Text style={styles.brand}>LIVE</Text>
                <Text style={[styles.brand, styles.brandAccent]}>ZONE</Text>
              </View>
            </View>
          </View>
          <Text style={styles.title}>Settings</Text>
          <Text style={styles.copy}>
            Preferred sport and tier load on the scoreboard when you open LiveZone. Stored only on this device.
          </Text>
        </View>

        <View style={styles.panel}>
          <Text style={styles.section}>Preferred sport</Text>
          <View style={styles.chips}>
            {SPORTS.map((item) => (
              <SettingChip
                key={item.id}
                label={item.label}
                selected={ready && prefs.preferredSport === item.id}
                onPress={() => setSport(item.id)}
              />
            ))}
          </View>
        </View>

        <View style={styles.panel}>
          <Text style={styles.section}>Preferred tier</Text>
          <View style={styles.chips}>
            {TIERS.map((item) => (
              <SettingChip
                key={item.id}
                label={item.label}
                selected={ready && prefs.preferredTier === item.id}
                onPress={() => setTier(item.id)}
              />
            ))}
          </View>
        </View>

        <View style={styles.panel}>
          <Text style={styles.section}>Server: API_SPORTS_STRICT</Text>
          <Text style={styles.copy}>
            Demo vs live is shown by the DEMO badge on the scoreboard. Set the server env var{" "}
            <Text style={styles.code}>API_SPORTS_STRICT=1</Text> (or{" "}
            <Text style={styles.code}>LIVEZONE_FAIL_HARD=1</Text>) so API failures return an empty/error payload
            instead of falling back to demo data. This is a deploy-time setting — not a client toggle — because the
            API key and upstream calls stay on the server.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.night },
  body: { padding: 16, gap: 12, paddingBottom: 40 },
  header: {
    gap: 6,
    borderTopWidth: 3,
    borderTopColor: colors.lime,
    paddingTop: 12,
    marginBottom: 4,
  },
  eyebrow: {
    color: colors.mist,
    fontFamily: fonts.uiBold,
    fontSize: 11,
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  brandLockup: { flexDirection: "row", alignItems: "center", gap: 12 },
  brandMark: {
    width: 48,
    height: 48,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.panelBorderStrong,
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
  code: { color: colors.lime, fontFamily: "monospace" },
  panel: {
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.panelBorder,
    borderLeftWidth: 3,
    borderLeftColor: colors.lime,
    padding: 14,
    gap: 10,
  },
  section: {
    color: colors.mist,
    fontFamily: fonts.uiBold,
    fontSize: 11,
    letterSpacing: 1.6,
    textTransform: "uppercase",
  },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
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
});
