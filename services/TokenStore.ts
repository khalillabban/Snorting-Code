// services/TokenStore.ts
import * as SecureStore from "expo-secure-store";

const ACCESS_TOKEN_KEY = "google_access_token";
const TOKEN_META_KEY = "google_access_token_meta";

type TokenMeta = {
  issuedAt?: number;   // seconds (from expo auth)
  expiresIn?: number;  // seconds
};

export async function saveGoogleAccessToken(
  accessToken: string,
  meta?: TokenMeta,
) {
  await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, accessToken);
  if (meta) {
    await SecureStore.setItemAsync(TOKEN_META_KEY, JSON.stringify(meta));
  } else {
    await SecureStore.deleteItemAsync(TOKEN_META_KEY);
  }
}

export async function getGoogleAccessToken(): Promise<{
  accessToken: string | null;
  meta: TokenMeta | null;
}> {
  const accessToken = await SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
  const metaRaw = await SecureStore.getItemAsync(TOKEN_META_KEY);

  let meta: TokenMeta | null = null;
  if (metaRaw) {
    try {
      meta = JSON.parse(metaRaw) as TokenMeta;
    } catch {
      meta = null;
    }
  }

  return { accessToken, meta };
}

export async function deleteGoogleAccessToken() {
  await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
  await SecureStore.deleteItemAsync(TOKEN_META_KEY);
}

export function isTokenLikelyExpired(meta: TokenMeta | null): boolean {
  if (!meta?.issuedAt || !meta?.expiresIn) return false; // unknown -> assume OK
  const nowSec = Math.floor(Date.now() / 1000);
  // subtract 60s for safety
  return nowSec >= meta.issuedAt + meta.expiresIn - 60;
}