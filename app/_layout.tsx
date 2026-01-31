import { Stack } from "expo-router";

export default function RootLayout() {
  return <Stack>
    <Stack.Screen name="index" options={{ title: "Home" }} />
    <Stack.Screen name="CampusMapScreen" options={{ title: "Campus Map" }} />
  </Stack>;
}
