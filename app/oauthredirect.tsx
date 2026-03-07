import { useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useEffect, useState } from "react";
import { Text, View } from "react-native";

export default function OAuthRedirect() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleRedirect = async () => {
      try {
        await WebBrowser.maybeCompleteAuthSession();
        router.replace("/schedule");
      } catch (e: any) {
        setError(e?.message ?? "Something went wrong. Please try again.");
      }
    };

    handleRedirect();
  }, [router]);

  if (error) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <Text>{error}</Text>
      </View>
    );
  }

  return null;
}