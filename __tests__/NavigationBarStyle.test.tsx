// __tests__/NavigationBarStyle.test.tsx

// Mock Dimensions BEFORE importing the styles module
jest.mock("react-native", () => {
  const RN = jest.requireActual("react-native");
  RN.Dimensions = {
    get: jest.fn(() => ({ height: 1334, width: 750 })),
  };
  return RN;
});

// Mock theme colors BEFORE importing the styles module
jest.mock("../constants/theme", () => ({
  colors: { primary: "#912338" },
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
