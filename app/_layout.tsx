import Constants from "expo-constants";
import { Stack } from "expo-router";
import { useCallback, useEffect, useRef } from "react";
import {
    resetSession,
    USABILITY_TESTING_ENABLED,
} from "../constants/usabilityConfig";
import { ColorAccessibilityProvider, useColorAccessibility } from "../contexts/ColorAccessibilityContext";

function AppStack({
  onStateChange,
}: Readonly<{
  onStateChange: (state: any) => void;
}>) {
  const { colors } = useColorAccessibility();

  return (
    <Stack
      screenListeners={{ state: (e) => onStateChange(e.data.state) }}
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

export default function RootLayout() {
  const smartlookRef = useRef<any>(null);
  const prevRouteRef = useRef<string | null>(null);

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
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const Smartlook = require("react-native-smartlook-analytics").default;
      Smartlook.instance.preferences.setProjectKey(projectKey);
      Smartlook.instance.start();
      smartlookRef.current = Smartlook;
    } catch (error) {
      console.warn("Smartlook is not available in this build.", error);
    }
  }, []);

  const handleStateChange = useCallback((state: any) => {
    const sl = smartlookRef.current;
    if (!sl || !state) return;
    const route = state.routes?.[state.index];
    if (!route) return;

    const name = route.name as string;
    if (name === prevRouteRef.current) return;

    if (prevRouteRef.current) {
      sl.instance.analytics.trackNavigationExit(prevRouteRef.current);
    }
    sl.instance.analytics.trackNavigationEnter(name);
    prevRouteRef.current = name;
  }, []);

  return (
    <ColorAccessibilityProvider>
      <AppStack onStateChange={handleStateChange} />
    </ColorAccessibilityProvider>
  );
}
