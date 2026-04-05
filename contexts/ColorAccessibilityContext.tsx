import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  COLOR_ACCESSIBILITY_OPTIONS,
  colors as fallbackColors,
  getThemePalette,
  type ColorAccessibilityMode,
  type ThemePalette,
} from "../constants/theme";

const STORAGE_KEY = "snorting-code.color-accessibility-mode";

function resolveThemePalette(mode: ColorAccessibilityMode): ThemePalette {
  if (typeof getThemePalette === "function") {
    return getThemePalette(mode);
  }

  // Some tests mock constants/theme without getThemePalette.
  return fallbackColors as unknown as ThemePalette;
}

type ColorAccessibilityContextValue = {
  mode: ColorAccessibilityMode;
  colors: ThemePalette;
  options: typeof COLOR_ACCESSIBILITY_OPTIONS;
  setMode: (mode: ColorAccessibilityMode) => void;
  isHydrated: boolean;
};

const defaultValue: ColorAccessibilityContextValue = {
  mode: "classic",
  colors: resolveThemePalette("classic"),
  options: COLOR_ACCESSIBILITY_OPTIONS,
  setMode: () => {},
  isHydrated: true,
};

const ColorAccessibilityContext =
  createContext<ColorAccessibilityContextValue>(defaultValue);

export function ColorAccessibilityProvider({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const isTestEnvironment = process.env.NODE_ENV === "test";
  const [mode, setMode] = useState<ColorAccessibilityMode>("classic");
  const [isHydrated, setIsHydrated] = useState(isTestEnvironment);

  useEffect(() => {
    if (isTestEnvironment) {
      return;
    }

    let cancelled = false;

    const loadMode = async () => {
      try {
        const saved = await AsyncStorage.getItem(STORAGE_KEY);
        if (cancelled) return;
        if (
          saved &&
          COLOR_ACCESSIBILITY_OPTIONS.some((option) => option.value === saved)
        ) {
          setMode(saved as ColorAccessibilityMode);
        }
      } catch (error) {
        console.warn("Failed to load color accessibility mode.", error);
      } finally {
        if (!cancelled) {
          setIsHydrated(true);
        }
      }
    };

    void loadMode();

    return () => {
      cancelled = true;
    };
  }, [isTestEnvironment]);

  useEffect(() => {
    if (!isHydrated || isTestEnvironment) return;
    Promise.resolve(AsyncStorage.setItem(STORAGE_KEY, mode)).catch((error) => {
      console.warn("Failed to save color accessibility mode.", error);
    });
  }, [isHydrated, isTestEnvironment, mode]);

  const value = useMemo<ColorAccessibilityContextValue>(
    () => ({
      mode,
      colors: resolveThemePalette(mode),
      options: COLOR_ACCESSIBILITY_OPTIONS,
      setMode,
      isHydrated,
    }),
    [isHydrated, mode],
  );

  return (
    <ColorAccessibilityContext.Provider value={value}>
      {children}
    </ColorAccessibilityContext.Provider>
  );
}

export function useColorAccessibility() {
  return useContext(ColorAccessibilityContext);
}
