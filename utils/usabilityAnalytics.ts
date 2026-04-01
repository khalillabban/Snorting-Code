import { USABILITY_TESTING_ENABLED } from "../constants/usabilityConfig";

export async function logUsabilityEvent(
  eventName: string,
  params: Record<string, unknown> = {},
): Promise<void> {
  if (!USABILITY_TESTING_ENABLED) return;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const analytics = require("@react-native-firebase/analytics").default;
    await analytics().logEvent(eventName, params);
  } catch (error) {
    console.error("Firebase Analytics Error:", eventName, error);
  }
}
