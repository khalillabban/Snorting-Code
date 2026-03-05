// services/GoogleAuthService.ts
import * as AuthSession from "expo-auth-session";
import * as Google from "expo-auth-session/providers/google";
import Constants, { ExecutionEnvironment } from "expo-constants";
import * as WebBrowser from "expo-web-browser";
import { useCallback } from "react";
import { Platform } from "react-native";

WebBrowser.maybeCompleteAuthSession();

const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/calendar.readonly",
] as const;

export type GoogleAuthResult =
  | { ok: true; accessToken: string; expiresIn?: number; issuedAt?: number }
  | { ok: false; reason: "cancelled" | "failed"; message?: string };

function getGoogleClientIds() {
  const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
  const androidClientId = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID;
  const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;

  if (!iosClientId && !androidClientId && !webClientId) {
    throw new Error(
      "Missing Google OAuth client IDs. Set at least one of:\n" +
        "- EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID\n" +
        "- EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID\n" +
        "- EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID\n" +
        "Then restart Expo.",
    );
  }
  return { iosClientId, androidClientId, webClientId };
}

function isExpoGo(): boolean {
  return Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
}

/**
 * In Expo Go: makeRedirectUri() returns exp://192.168.x.x:8081
 * Google does NOT accept dynamic IPs as redirect URIs.
 *
 * Solution: use your WEB client ID + redirect to a fixed localhost URI
 * that Google allows, handled entirely in the browser flow.
 *
 * For standalone builds: use the reverse client-id native scheme.
 */
function buildRedirectUri(ids: ReturnType<typeof getGoogleClientIds>): string {
  if (isExpoGo()) {
    // Use a fixed localhost URI — works for Expo Go via the browser flow.
    // Register exactly this in Google Console → Web client → Authorized redirect URIs.
    return AuthSession.makeRedirectUri({
      scheme: "exp",
      path: "oauthredirect",
    });
  }

  // Standalone build — reverse client-id native scheme
  const clientId =
    Platform.OS === "android" ? ids.androidClientId : ids.iosClientId;
  if (!clientId) throw new Error(`Missing ${Platform.OS} Google client ID.`);
  const prefix = clientId.replace(".apps.googleusercontent.com", "");
  return `com.googleusercontent.apps.${prefix}:/oauthredirect`;
}

export function useGoogleCalendarAuth(options?: { scopes?: string[] }) {
  const ids = getGoogleClientIds();
  const redirectUri = buildRedirectUri(ids);

  const [request, response, promptAsync] = Google.useAuthRequest({
    iosClientId: ids.iosClientId,
    androidClientId: ids.androidClientId,
    // ⚠️ In Expo Go you MUST use the webClientId for the OAuth flow
    // because the native client IDs require a registered app binary.
    clientId: isExpoGo() ? ids.webClientId : undefined,
    webClientId: ids.webClientId,
    scopes: options?.scopes ?? [...GOOGLE_SCOPES],
    redirectUri,
  });

  const getResultFromResponse = useCallback((): GoogleAuthResult | null => {
    if (!response) return null;

    if (response.type === "success") {
      const auth = response.authentication;
      if (!auth?.accessToken) {
        return {
          ok: false,
          reason: "failed",
          message: "No access token returned.",
        };
      }
      return {
        ok: true,
        accessToken: auth.accessToken,
        expiresIn: auth.expiresIn,
        issuedAt: auth.issuedAt,
      };
    }

    if (response.type === "dismiss" || response.type === "cancel") {
      return { ok: false, reason: "cancelled" };
    }

    const errorDesc = (response as any)?.params?.error_description;
    const error = (response as any)?.params?.error;
    return {
      ok: false,
      reason: "failed",
      message:
        errorDesc || error
          ? `Authentication failed: ${errorDesc ?? error}`
          : "Authentication failed.",
    };
  }, [response]);

  return {
    request,
    response,
    redirectUri, // log this — paste it exactly into Google Console
    promptAsync: () => promptAsync(),
    getResultFromResponse,
  };
}
