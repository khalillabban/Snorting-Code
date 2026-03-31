import Constants from "expo-constants";
import { Stack } from "expo-router";
import { useEffect } from "react";
import { colors } from "../constants/theme";
import {
  resetSession,
  USABILITY_TESTING_ENABLED,
} from "../constants/usabilityConfig";

export default function RootLayout() {
  useEffect(() => {
    if (USABILITY_TESTING_ENABLED) {
      resetSession();
    }

    const projectKey = process.env.EXPO_PUBLIC_SMARTLOOK_PROJECT_KEY;

    if (!projectKey) {
      return;
    }

    if (Constants.executionEnvironment === "storeClient") {
      return;
    }

    try {
      const Smartlook = require("react-native-smartlook-analytics").default;
      Smartlook.instance.preferences.setProjectKey(projectKey);
      Smartlook.instance.start();
    } catch (error) {
      console.warn("Smartlook is not available in this build.", error);
    }
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
        options={{
          title: "Campus Map",
          headerBackButtonDisplayMode: "minimal",
        }}
      />
      <Stack.Screen name="IndoorMapScreen" options={{ title: "Indoor Map" }} />
      <Stack.Screen
        name="schedule"
        options={{ title: "Schedule", headerBackButtonDisplayMode: "minimal" }}
      />
    </Stack>
  );
}
