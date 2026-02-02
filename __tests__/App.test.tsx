import React from "react";
import { render, screen } from "@testing-library/react-native";
import Index from "../app/index";

describe("Home Screen", () => {
  it("renders the welcome screen title", () => {
    render(<Index />);
    expect(screen.getByText("Concordia Maps")).toBeTruthy();
  });

  it("renders the campus selection subtitle", () => {
    render(<Index />);
    expect(screen.getByText("Select a campus")).toBeTruthy();
  });

  it("renders the SGW Campus button", () => {
    render(<Index />);
    expect(screen.getByText("SGW Campus")).toBeTruthy();
  });

  it("renders the Loyola Campus button", () => {
    render(<Index />);
    expect(screen.getByText("Loyola Campus")).toBeTruthy();
  });
});
