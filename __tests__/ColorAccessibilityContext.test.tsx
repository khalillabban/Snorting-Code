import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import React from "react";
import { Pressable, Text, View } from "react-native";
import {
    ColorAccessibilityProvider,
    useColorAccessibility,
    withOpacity,
} from "../contexts/ColorAccessibilityContext";

function Probe() {
  const { mode, colors, setMode, isHydrated, options } = useColorAccessibility();

  return (
    <View>
      <Text testID="mode">{mode}</Text>
      <Text testID="primary">{colors.primary}</Text>
      <Text testID="hydrated">{String(isHydrated)}</Text>
      <Text testID="options-count">{String(options.length)}</Text>

      <Pressable testID="set-red-green" onPress={() => setMode("redGreenSafe")}>
        <Text>set-red-green</Text>
      </Pressable>
      <Pressable testID="set-blue-yellow" onPress={() => setMode("blueYellowSafe")}>
        <Text>set-blue-yellow</Text>
      </Pressable>
      <Pressable testID="set-high-contrast" onPress={() => setMode("highContrast")}>
        <Text>set-high-contrast</Text>
      </Pressable>
      <Pressable testID="set-classic" onPress={() => setMode("classic")}>
        <Text>set-classic</Text>
      </Pressable>
    </View>
  );
}

describe("ColorAccessibilityContext", () => {
  type NodeEnv = "development" | "production" | "test";
  const originalNodeEnv: NodeEnv =
    (process.env.NODE_ENV as NodeEnv | undefined) ?? "test";

  const setNodeEnv = (value: NodeEnv) => {
    jest.replaceProperty(process, "env", {
      ...process.env,
      NODE_ENV: value,
    });
  };

  beforeEach(() => {
    jest.clearAllMocks();
    setNodeEnv(originalNodeEnv);
  });

  afterEach(() => {
    setNodeEnv(originalNodeEnv);
  });

  it("starts hydrated in test env with classic mode and all options", () => {
    render(
      <ColorAccessibilityProvider>
        <Probe />
      </ColorAccessibilityProvider>,
    );

    expect(screen.getByTestId("mode").props.children).toBe("classic");
    expect(screen.getByTestId("primary").props.children).toBe("#912338");
    expect(screen.getByTestId("hydrated").props.children).toBe("true");
    expect(screen.getByTestId("options-count").props.children).toBe("4");
  });

  it("exposes safe default values when used outside the provider", () => {
    render(<Probe />);

    expect(screen.getByTestId("mode").props.children).toBe("classic");
    expect(screen.getByTestId("hydrated").props.children).toBe("true");
    fireEvent.press(screen.getByTestId("set-high-contrast"));
    expect(screen.getByTestId("mode").props.children).toBe("classic");
  });

  it("switches palettes when mode changes", () => {
    render(
      <ColorAccessibilityProvider>
        <Probe />
      </ColorAccessibilityProvider>,
    );

    fireEvent.press(screen.getByTestId("set-red-green"));
    expect(screen.getByTestId("mode").props.children).toBe("redGreenSafe");
    expect(screen.getByTestId("primary").props.children).toBe("#1557B0");

    fireEvent.press(screen.getByTestId("set-blue-yellow"));
    expect(screen.getByTestId("mode").props.children).toBe("blueYellowSafe");
    expect(screen.getByTestId("primary").props.children).toBe("#8E2B5C");

    fireEvent.press(screen.getByTestId("set-high-contrast"));
    expect(screen.getByTestId("mode").props.children).toBe("highContrast");
    expect(screen.getByTestId("primary").props.children).toBe("#111111");

    fireEvent.press(screen.getByTestId("set-classic"));
    expect(screen.getByTestId("mode").props.children).toBe("classic");
    expect(screen.getByTestId("primary").props.children).toBe("#912338");
  });

  it("does not persist mode to AsyncStorage while NODE_ENV is test", () => {
    render(
      <ColorAccessibilityProvider>
        <Probe />
      </ColorAccessibilityProvider>,
    );

    fireEvent.press(screen.getByTestId("set-red-green"));
    fireEvent.press(screen.getByTestId("set-high-contrast"));

    expect(AsyncStorage.setItem).not.toHaveBeenCalled();
  });

  it("hydrates from AsyncStorage and persists updates outside test env", async () => {
    setNodeEnv("development");
    jest
      .spyOn(AsyncStorage, "getItem")
      .mockResolvedValueOnce("blueYellowSafe");
    const setItemSpy = jest
      .spyOn(AsyncStorage, "setItem")
      .mockResolvedValue(undefined);

    render(
      <ColorAccessibilityProvider>
        <Probe />
      </ColorAccessibilityProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("hydrated").props.children).toBe("true");
      expect(screen.getByTestId("mode").props.children).toBe("blueYellowSafe");
    });

    fireEvent.press(screen.getByTestId("set-high-contrast"));

    await waitFor(() => {
      expect(setItemSpy).toHaveBeenCalledWith(
        "snorting-code.color-accessibility-mode",
        "highContrast",
      );
    });
  });

  it("ignores invalid saved mode values", async () => {
    setNodeEnv("development");
    jest.spyOn(AsyncStorage, "getItem").mockResolvedValueOnce("invalid-mode");

    render(
      <ColorAccessibilityProvider>
        <Probe />
      </ColorAccessibilityProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("hydrated").props.children).toBe("true");
    });
    expect(screen.getByTestId("mode").props.children).toBe("classic");
  });

  it("warns and still hydrates when loading mode fails", async () => {
    setNodeEnv("development");
    jest.spyOn(AsyncStorage, "getItem").mockRejectedValueOnce(new Error("boom"));
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});

    render(
      <ColorAccessibilityProvider>
        <Probe />
      </ColorAccessibilityProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("hydrated").props.children).toBe("true");
    });
    expect(warnSpy).toHaveBeenCalledWith(
      "Failed to load color accessibility mode.",
      expect.any(Error),
    );

    warnSpy.mockRestore();
  });

  it("warns when persisting mode fails outside test env", async () => {
    setNodeEnv("development");
    jest.spyOn(AsyncStorage, "getItem").mockResolvedValueOnce(null);
    jest
      .spyOn(AsyncStorage, "setItem")
      .mockRejectedValueOnce(new Error("save-failed"));
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});

    render(
      <ColorAccessibilityProvider>
        <Probe />
      </ColorAccessibilityProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("hydrated").props.children).toBe("true");
    });

    fireEvent.press(screen.getByTestId("set-red-green"));

    await waitFor(() => {
      expect(warnSpy).toHaveBeenCalledWith(
        "Failed to save color accessibility mode.",
        expect.any(Error),
      );
    });

    warnSpy.mockRestore();
  });

  it("stops hydration work when the provider unmounts before AsyncStorage resolves", async () => {
    setNodeEnv("development");
    const deferred = new Promise<string | null>((resolve) => {
      setTimeout(() => resolve("classic"), 0);
    });
    jest.spyOn(AsyncStorage, "getItem").mockReturnValueOnce(deferred);

    const view = render(
      <ColorAccessibilityProvider>
        <Probe />
      </ColorAccessibilityProvider>,
    );

    view.unmount();
    await waitFor(() => {
      expect(AsyncStorage.getItem).toHaveBeenCalledWith(
        "snorting-code.color-accessibility-mode",
      );
    });
  });

  it("converts three-digit hex values with opacity", () => {
    expect(withOpacity("#abc", 0.5)).toBe("rgba(170, 187, 204, 0.5)");
  });
});
