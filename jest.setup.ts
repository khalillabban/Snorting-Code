process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY = "test-key";

// Suppress known third-party library act() warnings that can't be fixed in app code
const originalError = global.console.error;

// Store patterns to suppress
const suppressPatterns = [
  /An update to Icon inside a test was not wrapped/i,
  /An update to VirtualizedList inside a test was not wrapped/i,
];

// Override console.error to catch and suppress known warnings
global.console.error = (...args: any[]) => {
  // React can emit formatted messages across multiple args (e.g. %s + component name).
  // Join all args so patterns still match reliably.
  const fullMessage = args.map((arg) => String(arg)).join(" ");

  const hasPattern =
    suppressPatterns.some((pattern) => pattern.test(fullMessage)) ||
    (fullMessage.includes("was not wrapped in act") &&
      (fullMessage.includes("VirtualizedList") || fullMessage.includes("Icon")));

  // Only log if no suppression pattern matched
  if (!hasPattern) {
    originalError.apply(global.console, args);
  }
};







