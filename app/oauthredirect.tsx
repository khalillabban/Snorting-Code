import { useEffect } from "react";
import * as WebBrowser from "expo-web-browser";
import { useRouter } from "expo-router";

export default function OAuthRedirect() {
  const router = useRouter();

  useEffect(() => {
    WebBrowser.maybeCompleteAuthSession();
    router.replace("/schedule");
  }, []);

  return null;
}