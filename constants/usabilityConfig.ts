// Usability Testing Toggle
// Set to true during usability testing sessions, false for production builds.
import * as Crypto from "expo-crypto";
export const USABILITY_TESTING_ENABLED = true;

let currentSessionId: string | null = null;

export const getSessionId = () => {
  if (!currentSessionId) {
    currentSessionId = `session_${Date.now()}_${Crypto.randomUUID()}`;
  }
  return currentSessionId;
};

export const resetSession = () => {
  currentSessionId = `session_${Date.now()}_${Crypto.randomUUID()}`;
  return currentSessionId;
};
