import { useEffect } from "react";
import { Stack } from "expo-router";
import Smartlook from "react-native-smartlook-analytics";
import { colors } from "../constants/theme";

export default function RootLayout() {
  useEffect(() => {
    Smartlook.instance.preferences.setProjectKey(process.env.EXPO_PUBLIC_SMARTLOOK_PROJECT_KEY!);
    Smartlook.instance.start();
  }, []);
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.primaryDark },
        headerTintColor: colors.white,
        headerTitleStyle: { fontWeight: "600" },
      }}
    >
      <Stack.Screen name="index" options={{ title: "Home" }} />
      <Stack.Screen
        name="CampusMapScreen"
        options={{ title: "Campus Map", headerBackButtonDisplayMode: "minimal" }}
      />
      <Stack.Screen
        name="IndoorMapScreen"
        options={{ title: "Indoor Map" }}
      />
      <Stack.Screen
        name="schedule"
        options={{ title: "Schedule", headerBackButtonDisplayMode: "minimal" }}
      />
    </Stack>
  );
}