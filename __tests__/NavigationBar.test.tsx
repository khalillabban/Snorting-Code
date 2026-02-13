import { fireEvent, render, waitFor } from "@testing-library/react-native";
import React from "react";
import NavigationBar from "../components/NavigationBar";

jest.mock("@expo/vector-icons", () => ({
  MaterialIcons: ({ name }: { name: string }) => {
    const React = require("react");
    const { Text } = require("react-native");
    return <Text accessibilityRole="image">{name}</Text>;
  },
}));

jest.mock("../styles/NavigationBar.styles", () => ({
  styles: {
    overlay: { flex: 1 },
    keyboardContainer: { flex: 1 },
    sheet: {},
    gestureArea: {},
    handle: {},
    content: {},
    inputGroup: {},
    input: {},
    suggestionList: {},
    suggestionItem: {},
    suggestionText: {},
    suggestionSubtext: {},
    searchButton: {},
    searchButtonText: {},
  },
}));

jest.mock("../constants/theme", () => ({
  colors: { primary: "#ff0000" },
}));

const BUILDINGS_MOCK = [
  { name: "HALL", displayName: "H Hall", campusName: "SGW" },
  { name: "MB", displayName: "John Molson (MB)", campusName: "SGW" },
  { name: "CJ", displayName: "Communication Studies (CJ)", campusName: "Loyola" },
] as const;

jest.mock("../constants/buildings", () => ({
  BUILDINGS: [
    { name: "HALL", displayName: "H Hall", campusName: "SGW" },
    { name: "MB", displayName: "John Molson (MB)", campusName: "SGW" },
    { name: "CJ", displayName: "Communication Studies (CJ)", campusName: "Loyola" },
  ],
}));

const mockSpringStart = jest.fn((cb?: () => void) => cb?.());
const mockTimingStart = jest.fn((cb?: () => void) => cb?.());

jest.mock("react-native", () => {
  const RN = jest.requireActual("react-native");

  const Animated = RN.Animated;

  Animated.Value = function Value(this: any, initial: number) {
    this._value = initial;
    this.setValue = jest.fn((v: number) => (this._value = v));
    return this;
  } as any;


  Animated.spring = jest.fn(() => ({ start: mockSpringStart })) as any;
  Animated.timing = jest.fn(() => ({ start: mockTimingStart })) as any;

  RN.PanResponder = {
    create: jest.fn(() => ({
      panHandlers: { onStartShouldSetResponder: jest.fn() },
    })),
  };

  RN.Dimensions = {
    get: jest.fn(() => ({ height: 1000, width: 400 })),
  };

  RN.Keyboard = {
    ...RN.Keyboard,
    dismiss: jest.fn(),
  };

  RN.Platform.OS = "ios";

  return RN;
});

describe("NavigationBar", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns null when visible=false initially", () => {
    const { queryByText, queryByPlaceholderText } = render(
      <NavigationBar visible={false} onClose={jest.fn()} onConfirm={jest.fn()} />,
    );

    expect(queryByText("Get Directions")).toBeNull();
    expect(queryByPlaceholderText("Search Here")).toBeNull();
  });

  it("renders sheet content when visible=true and starts open animation", async () => {
    const { getByPlaceholderText, getByText } = render(
      <NavigationBar visible={true} onClose={jest.fn()} onConfirm={jest.fn()} />,
    );

    expect(getByPlaceholderText("Search Here")).toBeTruthy();
    expect(getByText("Get Directions")).toBeTruthy();

    await waitFor(() => expect(mockSpringStart).toHaveBeenCalled());
  });

  it("filters buildings when typing and shows suggestion list", () => {
    const { getByPlaceholderText, getByText, queryByText } = render(
      <NavigationBar visible={true} onClose={jest.fn()} onConfirm={jest.fn()} />,
    );

    fireEvent.changeText(getByPlaceholderText("Search Here"), "mb");

    expect(getByText("John Molson (MB)")).toBeTruthy();
    expect(queryByText("Get Directions")).toBeNull();
  });

  it("selecting a building sets input value, clears suggestions, and shows confirm button", () => {
    const { getByPlaceholderText, getByText, queryByText } = render(
      <NavigationBar visible={true} onClose={jest.fn()} onConfirm={jest.fn()} />,
    );

    const input = getByPlaceholderText("Search Here");
    fireEvent.changeText(input, "hall");

    fireEvent.press(getByText("H Hall"));

    expect(queryByText("H Hall")).toBeNull();
    expect(getByPlaceholderText("Search Here").props.value).toBe("H Hall");
    expect(getByText("Get Directions")).toBeTruthy();
  });

  it("pressing Get Directions calls onConfirm(dest selected) then onClose", () => {
    const onClose = jest.fn();
    const onConfirm = jest.fn();

    const { getByPlaceholderText, getByText } = render(
      <NavigationBar visible={true} onClose={onClose} onConfirm={onConfirm} />,
    );

    fireEvent.changeText(getByPlaceholderText("Search Here"), "CJ");
    fireEvent.press(getByText("Communication Studies (CJ)"));

    fireEvent.press(getByText("Get Directions"));

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onConfirm).toHaveBeenCalledWith(null, BUILDINGS_MOCK[2]);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("tapping the overlay closes", () => {
    const onClose = jest.fn();

    const { UNSAFE_getAllByType } = render(
      <NavigationBar visible={true} onClose={onClose} onConfirm={jest.fn()} />,
    );

    const touchables = UNSAFE_getAllByType(
      require("react-native").TouchableWithoutFeedback,
    );
    fireEvent.press(touchables[0]);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("when visible toggles true -> false, it runs close animation and unmounts after callback", async () => {
    const { rerender, queryByPlaceholderText } = render(
      <NavigationBar visible={true} onClose={jest.fn()} onConfirm={jest.fn()} />,
    );

    expect(queryByPlaceholderText("Search Here")).toBeTruthy();

    rerender(<NavigationBar visible={false} onClose={jest.fn()} onConfirm={jest.fn()} />);

    await waitFor(() => expect(mockTimingStart).toHaveBeenCalled());

    expect(queryByPlaceholderText("Search Here")).toBeNull();
  });

  it("typing and selecting a starting location updates startLoc and calls onConfirm", () => {
    const onClose = jest.fn();
    const onConfirm = jest.fn();

    const { getByPlaceholderText, getByText, queryByText } = render(
      <NavigationBar visible={true} onClose={onClose} onConfirm={onConfirm} />,
    );

    const startInput = getByPlaceholderText("Starting location");
    fireEvent.changeText(startInput, "H Hall");

    expect(getByText("H Hall")).toBeTruthy();
    expect(queryByText("Get Directions")).toBeNull(); // confirm button hidden while searching

    fireEvent.press(getByText("H Hall"));

    expect(getByPlaceholderText("Starting location").props.value).toBe("H Hall");

    expect(queryByText("H Hall")).toBeNull();
    expect(getByText("Get Directions")).toBeTruthy();
    fireEvent.press(getByText("Get Directions"));

    expect(onConfirm).toHaveBeenCalledWith(BUILDINGS_MOCK[0], null);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
