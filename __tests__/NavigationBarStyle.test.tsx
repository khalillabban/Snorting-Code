// __tests__/NavigationBarStyle.test.tsx

// Mock Dimensions BEFORE importing the styles module
jest.mock("react-native", () => {
  const RN = jest.requireActual("react-native");
  RN.Dimensions = {
    get: jest.fn(() => ({ height: 1334, width: 750 })),
  };
  return RN;
});

jest.mock("../constants/theme", () => ({
  colors: { primary: "#912338", black: "#1a1a1a", gray100: "#e5e5e5", gray500: "#737373", gray700: "#404040", white: "#ffffff", offWhite: "#f2f2f2" },
  spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 },
}));

// NOW import the styles (after mocks are set up)
import {
    FULL_HEIGHT,
    PEEK_HEIGHT,
    styles,
} from "../styles/NavigationBar.styles";

describe("NavigationBar Styles", () => {
  it("calculates FULL_HEIGHT as 90% of screen height", () => {
    expect(FULL_HEIGHT).toBeCloseTo(1200.6, 1); // Allows small floating-point differences
  });

  it("exports PEEK_HEIGHT constant", () => {
    expect(PEEK_HEIGHT).toBe(120);
  });

  it("sheet style has correct height from FULL_HEIGHT", () => {
    expect(styles.sheet.height).toBeCloseTo(1200.6, 1);
  });

  it("searchButton uses primary color from theme", () => {
    expect(styles.searchButton.backgroundColor).toBe("#912338");
  });
});
