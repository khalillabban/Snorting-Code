// __tests__/GoogleAuthService.test.tsx
import { render } from "@testing-library/react-native";
import React from "react";
import { Text } from "react-native";

const mockMakeRedirectUri = jest.fn((..._args: any[]) => "proxy://redirect");
const mockUseAuthRequest: jest.Mock<any, any> = jest.fn(); // ✅ prevent narrow tuple inference
const mockMaybeCompleteAuthSession = jest.fn((..._args: any[]) => undefined);

jest.mock("expo-auth-session", () => ({
  makeRedirectUri: (...args: any[]) => mockMakeRedirectUri(...args),
}));

jest.mock("expo-auth-session/providers/google", () => ({
  useAuthRequest: (...args: any[]) => mockUseAuthRequest(...args),
}));

jest.mock("expo-web-browser", () => ({
  maybeCompleteAuthSession: (...args: any[]) => mockMaybeCompleteAuthSession(...args),
}));

function HookHarness({
  options,
  onValue,
}: {
  options?: any;
  onValue: (val: any) => void;
}) {
  const { useGoogleCalendarAuth } = require("../services/GoogleAuthService");
  const val = useGoogleCalendarAuth(options);
  onValue(val);
  return <Text>ok</Text>;
}

describe("services/GoogleAuthService", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    delete process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
    delete process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;

    mockUseAuthRequest.mockReturnValue([{ id: "req" }, null, jest.fn()]);
  });

  it("calls maybeCompleteAuthSession on module import", () => {
    process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID = "123.apps.googleusercontent.com";

    jest.isolateModules(() => {
      require("../services/GoogleAuthService");
    });

    expect(mockMaybeCompleteAuthSession).toHaveBeenCalledTimes(1);
  });

  it("throws when no client IDs exist", () => {
    expect(() => {
      render(<HookHarness options={{}} onValue={() => {}} />);
    }).toThrow(/Missing Google OAuth client IDs/i);
  });

  it("useProxy true uses makeRedirectUri and does not require iosClientId", () => {
    process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID = "web-client-id";

    let result: any;
    render(<HookHarness options={{ useProxy: true }} onValue={(v) => (result = v)} />);

    expect(mockMakeRedirectUri).toHaveBeenCalledTimes(1);
    expect(result.redirectUri).toBe("proxy://redirect");
  });

  it("useProxy false throws if iosClientId missing even when webClientId exists", () => {
    process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID = "web-client-id";

    expect(() => {
      render(<HookHarness options={{ useProxy: false }} onValue={() => {}} />);
    }).toThrow(/Missing EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID/i);
  });

  it("computes redirect URI from ios client id when not using proxy", () => {
    process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID = "123.apps.googleusercontent.com";

    let result: any;
    render(<HookHarness onValue={(v) => (result = v)} />);

    expect(result.redirectUri).toBe("com.googleusercontent.apps.123:/oauthredirect");
    expect(mockMakeRedirectUri).not.toHaveBeenCalled();
  });

  it("passes default scopes to Google.useAuthRequest", () => {
    process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID = "123.apps.googleusercontent.com";

    render(<HookHarness onValue={() => {}} />);

    const config = mockUseAuthRequest.mock.calls[0][0];
    expect(config.scopes).toEqual(["https://www.googleapis.com/auth/calendar.readonly"]);
  });

  it("passes custom scopes when provided", () => {
    process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID = "123.apps.googleusercontent.com";

    render(<HookHarness options={{ scopes: ["a", "b"] }} onValue={() => {}} />);

    const config = mockUseAuthRequest.mock.calls[0][0];
    expect(config.scopes).toEqual(["a", "b"]);
  });

  it("promptAsync wrapper adds useProxy when proxy enabled", async () => {
    process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID = "web-client-id";

    const prompt = jest.fn().mockResolvedValue({ type: "success" });
    mockUseAuthRequest.mockReturnValue([{ id: "req" }, null, prompt]);

    let result: any;
    render(<HookHarness options={{ useProxy: true }} onValue={(v) => (result = v)} />);

    await result.promptAsync({ hello: true });
    expect(prompt).toHaveBeenCalledWith({ hello: true, useProxy: true });

    await result.promptAsync();
    expect(prompt).toHaveBeenCalledWith({ useProxy: true });
  });

  it("promptAsync forwards args untouched when proxy disabled", async () => {
    process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID = "123.apps.googleusercontent.com";

    const prompt = jest.fn().mockResolvedValue({ type: "success" });
    mockUseAuthRequest.mockReturnValue([{ id: "req" }, null, prompt]);

    let result: any;
    render(<HookHarness options={{ useProxy: false }} onValue={(v) => (result = v)} />);

    await result.promptAsync({ test: 1 });
    expect(prompt).toHaveBeenCalledWith({ test: 1 });

    await result.promptAsync();
    expect(prompt).toHaveBeenCalledWith(undefined);
  });

  it("getResultFromResponse returns null if response is null", () => {
    process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID = "123.apps.googleusercontent.com";

    let result: any;
    render(<HookHarness onValue={(v) => (result = v)} />);

    expect(result.getResultFromResponse()).toBeNull();
  });

  it("success without accessToken returns failed with helpful message", () => {
    process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID = "123.apps.googleusercontent.com";

    mockUseAuthRequest.mockReturnValue([{}, { type: "success", authentication: {} }, jest.fn()]);

    let result: any;
    render(<HookHarness onValue={(v) => (result = v)} />);

    expect(result.getResultFromResponse()).toEqual({
      ok: false,
      reason: "failed",
      message: expect.stringMatching(/no access token/i),
    });
  });

  it("success with accessToken returns ok", () => {
    process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID = "123.apps.googleusercontent.com";

    mockUseAuthRequest.mockReturnValue([
      {},
      { type: "success", authentication: { accessToken: "TOKEN", expiresIn: 10, issuedAt: 1 } },
      jest.fn(),
    ]);

    let result: any;
    render(<HookHarness onValue={(v) => (result = v)} />);

    expect(result.getResultFromResponse()).toEqual({
      ok: true,
      accessToken: "TOKEN",
      expiresIn: 10,
      issuedAt: 1,
    });
  });

  it("dismiss returns cancelled", () => {
    process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID = "123.apps.googleusercontent.com";

    mockUseAuthRequest.mockReturnValue([{}, { type: "dismiss" }, jest.fn()]);

    let result: any;
    render(<HookHarness onValue={(v) => (result = v)} />);

    expect(result.getResultFromResponse()).toEqual({ ok: false, reason: "cancelled" });
  });

  it("cancel returns cancelled", () => {
    process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID = "123.apps.googleusercontent.com";

    mockUseAuthRequest.mockReturnValue([{}, { type: "cancel" }, jest.fn()]);

    let result: any;
    render(<HookHarness onValue={(v) => (result = v)} />);

    expect(result.getResultFromResponse()).toEqual({ ok: false, reason: "cancelled" });
  });

  it("error with error_description formats message", () => {
    process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID = "123.apps.googleusercontent.com";

    mockUseAuthRequest.mockReturnValue([
      {},
      { type: "error", params: { error_description: "bad login" } },
      jest.fn(),
    ]);

    let result: any;
    render(<HookHarness onValue={(v) => (result = v)} />);

    expect(result.getResultFromResponse()).toEqual({
      ok: false,
      reason: "failed",
      message: "Authentication failed: bad login",
    });
  });

  it("error with error formats message", () => {
    process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID = "123.apps.googleusercontent.com";

    mockUseAuthRequest.mockReturnValue([
      {},
      { type: "error", params: { error: "access_denied" } },
      jest.fn(),
    ]);

    let result: any;
    render(<HookHarness onValue={(v) => (result = v)} />);

    expect(result.getResultFromResponse()).toEqual({
      ok: false,
      reason: "failed",
      message: "Authentication failed: access_denied",
    });
  });

  it("error with no params returns generic message", () => {
    process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID = "123.apps.googleusercontent.com";

    mockUseAuthRequest.mockReturnValue([{}, { type: "error" }, jest.fn()]);

    let result: any;
    render(<HookHarness onValue={(v) => (result = v)} />);

    expect(result.getResultFromResponse()).toEqual({
      ok: false,
      reason: "failed",
      message: "Authentication failed.",
    });
  });
});