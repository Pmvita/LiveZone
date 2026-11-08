import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useFonts, Figtree_500Medium, Figtree_700Bold, Figtree_800ExtraBold } from "@expo-google-fonts/figtree";
import { Oswald_600SemiBold, Oswald_700Bold } from "@expo-google-fonts/oswald";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { colors } from "../lib/theme";

export default function RootLayout() {
  const [loaded] = useFonts({
    Figtree_500Medium,
    Figtree_700Bold,
    Figtree_800ExtraBold,
    Oswald_600SemiBold,
    Oswald_700Bold,
  });

  if (!loaded) return null;

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.night },
          headerStyle: { backgroundColor: colors.night },
          headerTintColor: colors.paper,
          headerTitleStyle: { fontFamily: "Figtree_700Bold", color: colors.paper },
          headerShadowVisible: false,
        }}
      />
    </SafeAreaProvider>
  );
}
