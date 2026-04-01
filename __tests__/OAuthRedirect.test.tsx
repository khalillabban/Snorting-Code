import { render, waitFor } from "@testing-library/react-native";
import React from "react";

const mockReplace = jest.fn();
const mockMaybeCompleteAuthSession = jest.fn();

jest.mock("expo-router", () => ({
  __esModule: true,
  useRouter: () => ({ replace: mockReplace }),
}));

// IMPORTANT: support BOTH namespace import and default interop
jest.mock("expo-web-browser", () => ({
  __esModule: true,
  maybeCompleteAuthSession: mockMaybeCompleteAuthSession,
  default: {
    maybeCompleteAuthSession: mockMaybeCompleteAuthSession,
  },
}));

// require AFTER mocks are declared
// eslint-disable-next-line @typescript-eslint/no-require-imports
const OAuthRedirect = require("../app/oauthredirect").default;

describe("OAuthRedirect", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("completes auth session and redirects to /schedule", async () => {
    render(<OAuthRedirect />);

    await waitFor(() => {
      expect(mockMaybeCompleteAuthSession).toHaveBeenCalledTimes(1);
      expect(mockReplace).toHaveBeenCalledWith("/schedule");
    });
  });
});