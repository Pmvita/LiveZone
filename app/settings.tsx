import { Stack } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { StyleSheet, Text, View } from "react-native";

export default function SettingsScreen() {
  return (
    <SafeAreaView style={styles.screen} edges={["top", "left", "right"]}>
      <Stack.Screen options={{ headerShown: true, title: "Settings" }} />
      <View style={styles.body}>
        <Text style={styles.title}>Settings</Text>
        <Text style={styles.copy}>Demo vs live is shown by the DEMO badge on the scoreboard. Set API_SPORTS_STRICT=1 on the server to fail hard instead of falling back to demo data.</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#080a09" },
  body: { padding: 16, gap: 8 },
  title: { color: "#f3f6f1", fontSize: 24, fontWeight: "800" },
  copy: { color: "#8d988f", lineHeight: 20 },
});
