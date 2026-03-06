import * as AuthSession from "expo-auth-session";
import * as Google from "expo-auth-session/providers/google";
import * as WebBrowser from "expo-web-browser";
import { useCallback, useMemo } from "react";
import { Platform } from "react-native";

WebBrowser.maybeCompleteAuthSession();

const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/calendar.readonly",
] as const;

export type GoogleAuthResult =
  | {
      ok: true;
      accessToken: string;
      expiresIn?: number;
      issuedAt?: number;
    }
  | { ok: false; reason: "cancelled" | "failed"; message?: string };

function getGoogleClientIds() {
  const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
  const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
  const androidClientId = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID;

  if (!iosClientId && !webClientId && !androidClientId) {
    throw new Error(
      "Missing Google OAuth client IDs. Set at least one of:\n" +
        "- EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID\n" +
        "- EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID\n" +
        "- EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID (optional)\n" +
        "Then restart Expo.",
    );
  }

  return { iosClientId, webClientId, androidClientId };
}

const GOOGLE_CLIENT_IDS = getGoogleClientIds();

function computeRedirectUriFromClientId(clientId: string) {
  const prefix = clientId.split(".apps.googleusercontent.com")[0];
  return `com.googleusercontent.apps.${prefix}:/schedule`;
}

function getNativeRedirectUri(ids: ReturnType<typeof getGoogleClientIds>) {
  if (Platform.OS === "android") {
    if (!ids.androidClientId) {
      throw new Error(
        "Missing EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID. Android native auth requires an Android client ID.",
      );
    }
    return computeRedirectUriFromClientId(ids.androidClientId);
  }

  // iOS fallback
  if (!ids.iosClientId) {
    throw new Error(
      "Missing EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID. iOS native auth requires an iOS client ID.",
    );
  }
  return computeRedirectUriFromClientId(ids.iosClientId);
}

export function useGoogleCalendarAuth(options?: {
  useProxy?: boolean;
  scopes?: string[];
}) {
  const ids = GOOGLE_CLIENT_IDS;
  const useProxy = options?.useProxy ?? false;

  const redirectUri = useMemo(() => {
    if (useProxy) {
      return AuthSession.makeRedirectUri({ useProxy: true } as any);
    }
    return getNativeRedirectUri(ids);
  }, [ids.iosClientId, ids.androidClientId, useProxy]);

  const [request, response, promptAsync] = Google.useAuthRequest({
    iosClientId: ids.iosClientId,
    androidClientId: ids.androidClientId,
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
          message:
            "Login succeeded but no access token was returned. " +
            "Check auth configuration / scopes.",
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
    redirectUri,
    promptAsync: (promptOptions?: any) =>
      promptAsync(
        useProxy
          ? ({ ...(promptOptions ?? {}), useProxy: true } as any)
          : promptOptions,
      ),
    getResultFromResponse,
  };
}