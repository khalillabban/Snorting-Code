// services/GoogleAuthService.ts
import * as AuthSession from "expo-auth-session";
import * as Google from "expo-auth-session/providers/google";
import * as WebBrowser from "expo-web-browser";

WebBrowser.maybeCompleteAuthSession();

const GOOGLE_SCOPES = ["https://www.googleapis.com/auth/calendar.readonly"];

export type GoogleAuthResult =
  | { ok: true; accessToken: string; expiresIn?: number; issuedAt?: number }
  | { ok: false; reason: "cancelled" | "failed"; message?: string };

export function useGoogleCalendarAuth() {
  const clientId = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID;

  if (!clientId) {
    throw new Error(
      "Missing EXPO_PUBLIC_GOOGLE_CLIENT_ID. Put it in .env and restart Expo.",
    );
  }

  // Force Expo Auth Proxy redirect (https://auth.expo.io/@user/slug)
  // Your SDK typings don't expose useProxy, so we cast for TS.
  const redirectUri = AuthSession.makeRedirectUri({
    useProxy: true,
  } as any);

  const [request, response, promptAsync] = Google.useAuthRequest({
    clientId,
    scopes: GOOGLE_SCOPES,
    responseType: "token",
    redirectUri,
  });

  const getResultFromResponse = (): GoogleAuthResult | null => {
    if (!response) return null;

    if (response.type === "success") {
      const accessToken = response.authentication?.accessToken;
      if (!accessToken) {
        return {
          ok: false,
          reason: "failed",
          message: "No access token returned.",
        };
      }
      return {
        ok: true,
        accessToken,
        expiresIn: response.authentication?.expiresIn,
        issuedAt: response.authentication?.issuedAt,
      };
    }

    if (response.type === "dismiss" || response.type === "cancel") {
      return { ok: false, reason: "cancelled" };
    }

    return { ok: false, reason: "failed", message: "Authentication failed." };
  };

  return {
    request,
    response,
    // ALSO force proxy here (some SDKs only apply it at prompt time)
    promptAsync: (options?: any) =>
      promptAsync({ ...(options ?? {}), useProxy: true } as any),
    getResultFromResponse,
    redirectUri, // useful to log in UI to confirm you're using auth.expo.io
  };
}