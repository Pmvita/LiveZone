import AsyncStorage from "@react-native-async-storage/async-storage";
import type { SportId } from "./catalog";
import type { TierId } from "./tiers";

const KEY = "livezone:preferences";

export type Preferences = {
  preferredSport: SportId;
  preferredTier: TierId;
};

export const DEFAULT_PREFERENCES: Preferences = {
  preferredSport: "all",
  preferredTier: "all",
};

export async function loadPreferences(): Promise<Preferences> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT_PREFERENCES };
    const parsed = JSON.parse(raw) as Partial<Preferences>;
    return {
      preferredSport: parsed.preferredSport ?? DEFAULT_PREFERENCES.preferredSport,
      preferredTier: parsed.preferredTier ?? DEFAULT_PREFERENCES.preferredTier,
    };
  } catch {
    return { ...DEFAULT_PREFERENCES };
  }
}

export async function savePreferences(prefs: Preferences): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(prefs));
}

export async function updatePreferences(patch: Partial<Preferences>): Promise<Preferences> {
  const current = await loadPreferences();
  const next = { ...current, ...patch };
  await savePreferences(next);
  return next;
}
