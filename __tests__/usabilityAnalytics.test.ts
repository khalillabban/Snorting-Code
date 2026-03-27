describe("logUsabilityEvent", () => {
  afterEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  it("returns early when usability testing is disabled", async () => {
    jest.doMock("../constants/usabilityConfig", () => ({
      USABILITY_TESTING_ENABLED: false,
    }));

    const analyticsFactory = jest.fn(() => ({
      logEvent: jest.fn().mockResolvedValue(undefined),
    }));

    jest.doMock("@react-native-firebase/analytics", () => ({
      __esModule: true,
      default: analyticsFactory,
    }));

    let logUsabilityEvent!: (
      eventName: string,
      params?: Record<string, unknown>,
    ) => Promise<void>;
    jest.isolateModules(() => {
      logUsabilityEvent =
        require("../utils/usabilityAnalytics").logUsabilityEvent;
    });
    await expect(
      logUsabilityEvent("event_disabled", { a: 1 }),
    ).resolves.toBeUndefined();

    expect(analyticsFactory).not.toHaveBeenCalled();
  });

  it("logs analytics event when usability testing is enabled", async () => {
    const logEvent = jest.fn().mockResolvedValue(undefined);
    const analyticsFactory = jest.fn(() => ({ logEvent }));

    jest.doMock("../constants/usabilityConfig", () => ({
      USABILITY_TESTING_ENABLED: true,
    }));
    jest.doMock("@react-native-firebase/analytics", () => ({
      __esModule: true,
      default: analyticsFactory,
    }));

    let logUsabilityEvent!: (
      eventName: string,
      params?: Record<string, unknown>,
    ) => Promise<void>;
    jest.isolateModules(() => {
      logUsabilityEvent =
        require("../utils/usabilityAnalytics").logUsabilityEvent;
    });
    await logUsabilityEvent("schedule_screen_loaded", { screen: "schedule" });

    expect(analyticsFactory).toHaveBeenCalledTimes(1);
    expect(logEvent).toHaveBeenCalledWith("schedule_screen_loaded", {
      screen: "schedule",
    });
  });

  it("uses default empty params when none are provided", async () => {
    const logEvent = jest.fn().mockResolvedValue(undefined);
    const analyticsFactory = jest.fn(() => ({ logEvent }));

    jest.doMock("../constants/usabilityConfig", () => ({
      USABILITY_TESTING_ENABLED: true,
    }));
    jest.doMock("@react-native-firebase/analytics", () => ({
      __esModule: true,
      default: analyticsFactory,
    }));

    let logUsabilityEvent!: (
      eventName: string,
      params?: Record<string, unknown>,
    ) => Promise<void>;
    jest.isolateModules(() => {
      logUsabilityEvent =
        require("../utils/usabilityAnalytics").logUsabilityEvent;
    });

    await logUsabilityEvent("event_without_params");

    expect(analyticsFactory).toHaveBeenCalledTimes(1);
    expect(logEvent).toHaveBeenCalledWith("event_without_params", {});
  });

  it("swallows analytics errors without throwing", async () => {
    const analyticsFactory = jest.fn(() => {
      throw new Error("analytics unavailable");
    });

    jest.doMock("../constants/usabilityConfig", () => ({
      USABILITY_TESTING_ENABLED: true,
    }));
    jest.doMock("@react-native-firebase/analytics", () => ({
      __esModule: true,
      default: analyticsFactory,
    }));

    let logUsabilityEvent!: (
      eventName: string,
      params?: Record<string, unknown>,
    ) => Promise<void>;
    jest.isolateModules(() => {
      logUsabilityEvent =
        require("../utils/usabilityAnalytics").logUsabilityEvent;
    });
    await expect(
      logUsabilityEvent("event_error", { x: 1 }),
    ).resolves.toBeUndefined();
  });
});
