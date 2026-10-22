import Constants from "expo-constants";
import { Platform } from "react-native";

export function apiUrl(path: string): string {
  if (Platform.OS === "web") return path;
  const hostUri = Constants.expoConfig?.hostUri;
  if (!hostUri) return path;
  return `http://${hostUri}${path}`;
}
