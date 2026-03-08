// __tests__/ScheduleCalendar.test.tsx
import { fireEvent, render } from "@testing-library/react-native";
import React from "react";
import ScheduleCalendar from "../components/ScheduleCalendar";
import type { ScheduleItem } from "../constants/type";

// Helpers to build past/future dates relative to now
const hoursAgo = (h: number) => new Date(Date.now() - h * 3_600_000);
const hoursFromNow = (h: number) => new Date(Date.now() + h * 3_600_000);

function makeItem(
  id: string,
  courseName: string,
  start: Date,
  end: Date,
  location = "Room X",
  campus = "SGW",
  building = "H",
  room = "123",
  level = "1",
): ScheduleItem {
  return { id, courseName, start, end, location, campus, building, room, level };
}

describe("components/ScheduleCalendar", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest
      .spyOn(Date.prototype, "toLocaleTimeString")
      .mockImplementation(function (this: Date) {
        const hh = String(this.getUTCHours()).padStart(2, "0");
        const mm = String(this.getUTCMinutes()).padStart(2, "0");
        return `${hh}:${mm}`;
      });
  });

  afterEach(() => {
    (Date.prototype.toLocaleTimeString as unknown as jest.Mock).mockRestore?.();
  });

  // ---------------------------------------------------------------------------
  // Empty state
  // ---------------------------------------------------------------------------
  it("renders empty state when items is empty", () => {
    const { getByText } = render(<ScheduleCalendar items={[]} />);
    expect(getByText("No schedule items to display.")).toBeTruthy();
  });

  // ---------------------------------------------------------------------------
  // Upcoming section (expanded by default)
  // ---------------------------------------------------------------------------
  it("renders upcoming class details without toggling (expanded by default)", () => {
    const items: ScheduleItem[] = [
      makeItem("1", "SOEN 321", hoursFromNow(1), hoursFromNow(2), "EV 3.123"),
    ];

    const { getByText } = render(<ScheduleCalendar items={items} />);

    expect(getByText("SOEN 321")).toBeTruthy();
    expect(getByText("EV 3.123")).toBeTruthy();
  });

  it("shows accordion headers for both sections", () => {
    const items: ScheduleItem[] = [
      makeItem("u1", "Future Class", hoursFromNow(1), hoursFromNow(2)),
      makeItem("p1", "Past Class", hoursAgo(2), hoursAgo(1)),
    ];

    const { getByText } = render(<ScheduleCalendar items={items} />);

    expect(getByText(/Upcoming Classes/)).toBeTruthy();
    expect(getByText(/Past Classes/)).toBeTruthy();
  });

  it("shows both accordion section headers", () => {
    const items: ScheduleItem[] = [
      makeItem("u1", "Future A", hoursFromNow(1), hoursFromNow(2)),
      makeItem("u2", "Future B", hoursFromNow(3), hoursFromNow(4)),
      makeItem("p1", "Old A", hoursAgo(2), hoursAgo(1)),
    ];

    const { getByText } = render(<ScheduleCalendar items={items} />);

    expect(getByText("Upcoming Classes")).toBeTruthy();
    expect(getByText("Past Classes")).toBeTruthy();
  });

  // ---------------------------------------------------------------------------
  // Past section (collapsed by default)
  // ---------------------------------------------------------------------------
  it("hides past class content by default (past section collapsed)", () => {
    const items: ScheduleItem[] = [
      makeItem("p1", "Old Course", hoursAgo(2), hoursAgo(1)),
    ];

    const { queryByText } = render(<ScheduleCalendar items={items} />);
    // Past accordion is collapsed, so card text should not be visible
    expect(queryByText("Old Course")).toBeNull();
  });

  it("expands past section when its header is pressed", () => {
    const items: ScheduleItem[] = [
      makeItem("p1", "Old Course", hoursAgo(2), hoursAgo(1), "Hall 920"),
    ];

    const { getByTestId, getByText } = render(<ScheduleCalendar items={items} />);

    fireEvent.press(getByTestId("accordion-past"));

    expect(getByText("Old Course")).toBeTruthy();
    expect(getByText("Hall 920")).toBeTruthy();
  });

  // ---------------------------------------------------------------------------
  // Toggle collapse of upcoming section
  // ---------------------------------------------------------------------------
  it("collapses upcoming section when its header is pressed", () => {
    const items: ScheduleItem[] = [
      makeItem("u1", "Future Course", hoursFromNow(1), hoursFromNow(2)),
    ];

    const { getByTestId, queryByText } = render(<ScheduleCalendar items={items} />);

    // Visible before collapse
    expect(queryByText("Future Course")).toBeTruthy();

    fireEvent.press(getByTestId("accordion-upcoming"));

    // Hidden after collapse
    expect(queryByText("Future Course")).toBeNull();
  });

  // ---------------------------------------------------------------------------
  // Empty messages inside each section
  // ---------------------------------------------------------------------------
  it("shows 'No upcoming classes.' when all items are past", () => {
    const items: ScheduleItem[] = [
      makeItem("p1", "Old Course", hoursAgo(2), hoursAgo(1)),
    ];

    const { getByText } = render(<ScheduleCalendar items={items} />);
    expect(getByText("No upcoming classes.")).toBeTruthy();
  });

  it("shows 'No past classes.' when all items are upcoming", () => {
    const items: ScheduleItem[] = [
      makeItem("u1", "Future Course", hoursFromNow(1), hoursFromNow(2)),
    ];

    const { getByTestId, getByText } = render(<ScheduleCalendar items={items} />);
    // Expand past section to see its empty message
    fireEvent.press(getByTestId("accordion-past"));
    expect(getByText("No past classes.")).toBeTruthy();
  });

  // ---------------------------------------------------------------------------
  // Sorting within a section
  // ---------------------------------------------------------------------------
  it("sorts upcoming items within the same day by start time", () => {
    const early = makeItem("e", "Early Class", hoursFromNow(1), hoursFromNow(2), "Room A");
    const late = makeItem("l", "Late Class", hoursFromNow(5), hoursFromNow(6), "Room B");

    const { getAllByText } = render(
      <ScheduleCalendar items={[late, early]} />,
    );

    const titles = getAllByText(/(Early Class|Late Class)/).map(
      (n) => n.props.children,
    );
    expect(titles).toEqual(["Early Class", "Late Class"]);
  });

  // ---------------------------------------------------------------------------
  // Multiple items rendered
  // ---------------------------------------------------------------------------
  it("renders multiple upcoming items without crashing", () => {
    const items: ScheduleItem[] = [
      makeItem("a", "Class A", hoursFromNow(1), hoursFromNow(2), "A"),
      makeItem("b", "Class B", hoursFromNow(3), hoursFromNow(4), "B"),
    ];

    const { getByText } = render(<ScheduleCalendar items={items} />);
    expect(getByText("Class A")).toBeTruthy();
    expect(getByText("Class B")).toBeTruthy();
  });
});