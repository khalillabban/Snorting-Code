import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import { IndoorRoomSearchBar } from "../components/IndoorRoomSearchBar";

describe("IndoorRoomSearchBar (skeleton)", () => {
  it("renders input and forwards text changes", () => {
    const handleChange = jest.fn();

    const { getByTestId } = render(
      <IndoorRoomSearchBar value="" onChangeText={handleChange} />,
    );

    const input = getByTestId("indoor-room-search-input");
    fireEvent.changeText(input, "H837");

    expect(handleChange).toHaveBeenCalledWith("H837");
  });

  it("shows error message when provided", () => {
    const { getByText } = render(
      <IndoorRoomSearchBar
        value=""
        errorMessage="Room not found"
      />,
    );

    expect(getByText("Room not found")).toBeTruthy();
  });
});

