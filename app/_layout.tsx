import { Stack } from "expo-router";
import { colors } from "../constants/theme";

export default function RootLayout() {
  return <Stack
    screenOptions={{
      headerStyle: {
        backgroundColor: colors.primaryDark,
      },
      headerTintColor: colors.white,
      headerTitleStyle: {
        fontWeight: "600",
      },
    }}
  >
    <Stack.Screen name="index" options={{ title: "Home" }} />
    <Stack.Screen name="CampusMapScreen" 
      options={{ 
        title: "Campus Map",
        headerBackButtonDisplayMode: "minimal",
      }}
    />
  </Stack>;
}
