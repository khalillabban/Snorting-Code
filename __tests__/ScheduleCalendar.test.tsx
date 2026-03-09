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
  return {
    id,
    kind: "class",
    courseName,
    start,
    end,
    location,
    campus,
    building,
    room,
    level,
  };
}

function makeEvent(
  id: string,
  courseName: string,
  start: Date,
  end: Date,
  location = "Event Room",
  campus = "SGW",
  building = "H",
  room = "123",
  level = "1",
): ScheduleItem {
  return {
    id,
    kind: "event",
    courseName,
    start,
    end,
    location,
    campus,
    building,
    room,
    level,
  };
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
      makeItem("p1", "Old Course LEC", hoursAgo(2), hoursAgo(1)),
    ];

    const { queryByText } = render(<ScheduleCalendar items={items} />);
    // Past accordion is collapsed, so card text should not be visible
    expect(queryByText("Old Course LEC")).toBeNull();
  });

  it("expands past section when its header is pressed", () => {
    const items: ScheduleItem[] = [
      makeItem("p1", "Old Course LEC", hoursAgo(2), hoursAgo(1), "Hall 920"),
    ];

    const { getByTestId, getByText } = render(<ScheduleCalendar items={items} />);

    fireEvent.press(getByTestId("accordion-past-classes"));

    expect(getByText("Old Course LEC")).toBeTruthy();
    expect(getByText("Hall 920")).toBeTruthy();
  });

  // ---------------------------------------------------------------------------
  // Toggle collapse of upcoming section
  // ---------------------------------------------------------------------------
  it("collapses upcoming section when its header is pressed", () => {
    const items: ScheduleItem[] = [
      makeItem("u1", "Future Course LEC", hoursFromNow(1), hoursFromNow(2)),
    ];

    const { getByTestId, queryByText } = render(<ScheduleCalendar items={items} />);

    // Visible before collapse
    expect(queryByText("Future Course LEC")).toBeTruthy();

    fireEvent.press(getByTestId("accordion-upcoming-classes"));

    // Hidden after collapse
    expect(queryByText("Future Course LEC")).toBeNull();
  });

  // ---------------------------------------------------------------------------
  // Empty messages inside each section
  // ---------------------------------------------------------------------------
  it("shows 'No upcoming classes.' when all items are past", () => {
    const items: ScheduleItem[] = [
      makeItem("p1", "Old Course LEC", hoursAgo(2), hoursAgo(1)),
    ];

    const { getByText } = render(<ScheduleCalendar items={items} />);
    expect(getByText("No upcoming classes.")).toBeTruthy();
  });

  it("shows 'No past classes.' when all items are upcoming", () => {
    const items: ScheduleItem[] = [
      makeItem("u1", "Future Course LEC", hoursFromNow(1), hoursFromNow(2)),
    ];

    const { getByTestId, getByText } = render(<ScheduleCalendar items={items} />);
    // Expand past section to see its empty message
    fireEvent.press(getByTestId("accordion-past-classes"));
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

  // ---------------------------------------------------------------------------
  // String date normalization
  // ---------------------------------------------------------------------------
  it("normalizes string dates to Date objects", () => {
    const futureDate = hoursFromNow(1);
    const futureEnd = hoursFromNow(2);
    
    // Create items with string dates (simulating serialized data)
    const items = [
      {
        id: "str1",
        kind: "class",
        courseName: "String Date Class",
        start: futureDate.toISOString() as unknown as Date,
        end: futureEnd.toISOString() as unknown as Date,
        location: "Room A",
        campus: "SGW",
        building: "H",
        room: "123",
        level: "1",
      },
    ] as ScheduleItem[];

    const { getByText } = render(<ScheduleCalendar items={items} />);
    expect(getByText("String Date Class")).toBeTruthy();
  });

  // ---------------------------------------------------------------------------
  // Past classes rendering
  // ---------------------------------------------------------------------------
  it("renders multiple past classes when past section is expanded", () => {
    const items: ScheduleItem[] = [
      makeItem("p1", "Past A LEC", hoursAgo(5), hoursAgo(4), "Room A"),
      makeItem("p2", "Past B LEC", hoursAgo(3), hoursAgo(2), "Room B"),
    ];

    const { getByTestId, getByText } = render(<ScheduleCalendar items={items} />);

    fireEvent.press(getByTestId("accordion-past-classes"));

    expect(getByText("Past A LEC")).toBeTruthy();
    expect(getByText("Past B LEC")).toBeTruthy();
  });

  // ---------------------------------------------------------------------------
  // Re-expanding collapsed section
  // ---------------------------------------------------------------------------
  it("re-expands upcoming section after collapsing", () => {
    const items: ScheduleItem[] = [
      makeItem("u1", "Toggle Class LEC", hoursFromNow(1), hoursFromNow(2)),
    ];

    const { getByTestId, queryByText } = render(<ScheduleCalendar items={items} />);

    // Initially visible
    expect(queryByText("Toggle Class LEC")).toBeTruthy();

    // Collapse
    fireEvent.press(getByTestId("accordion-upcoming-classes"));
    expect(queryByText("Toggle Class LEC")).toBeNull();

    // Re-expand
    fireEvent.press(getByTestId("accordion-upcoming-classes"));
    expect(queryByText("Toggle Class LEC")).toBeTruthy();
  });

  it("collapses past section after expanding", () => {
    const items: ScheduleItem[] = [
      makeItem("p1", "Past Toggle LEC", hoursAgo(2), hoursAgo(1)),
    ];

    const { getByTestId, queryByText } = render(<ScheduleCalendar items={items} />);

    // Initially hidden (past collapsed by default)
    expect(queryByText("Past Toggle LEC")).toBeNull();

    // Expand
    fireEvent.press(getByTestId("accordion-past-classes"));
    expect(queryByText("Past Toggle LEC")).toBeTruthy();

    // Collapse again
    fireEvent.press(getByTestId("accordion-past-classes"));
    expect(queryByText("Past Toggle LEC")).toBeNull();
  });

  // ---------------------------------------------------------------------------
  // Time display
  // ---------------------------------------------------------------------------
  it("displays time range with en-dash separator", () => {
    const items: ScheduleItem[] = [
      makeItem("t1", "Time Test", hoursFromNow(1), hoursFromNow(2)),
    ];

    const { getByText } = render(<ScheduleCalendar items={items} />);
    
    // With our mock, times will be in HH:MM format
    // The component uses " – " (en-dash with spaces) as separator
    expect(getByText(/–/)).toBeTruthy();
  });

  // ---------------------------------------------------------------------------
  // Sorting past items
  // ---------------------------------------------------------------------------
  it("sorts past items by start time", () => {
    const earlier = makeItem("e", "Earlier Past LEC", hoursAgo(4), hoursAgo(3), "Room A");
    const later = makeItem("l", "Later Past LEC", hoursAgo(2), hoursAgo(1), "Room B");

    // Pass items in reverse order
    const { getByTestId, getAllByText } = render(
      <ScheduleCalendar items={[later, earlier]} />,
    );

    fireEvent.press(getByTestId("accordion-past-classes"));

    const titles = getAllByText(/(Earlier Past LEC|Later Past LEC)/).map(
      (n) => n.props.children,
    );
    expect(titles).toEqual(["Earlier Past LEC", "Later Past LEC"]);
  });

  it("uses item kind instead of title regex to place mixed items in class and event sections", () => {
    const items: ScheduleItem[] = [
      makeItem("class-no-keyword", "SOEN 321", hoursFromNow(1), hoursFromNow(2), "EV 3.123"),
      makeEvent("event-with-keyword", "Career Fair LEC", hoursAgo(4), hoursAgo(3), "EV Atrium"),
    ];

    const { getByTestId, getByText, queryByText } = render(<ScheduleCalendar items={items} />);

    expect(getByText("SOEN 321")).toBeTruthy();
    expect(queryByText("Career Fair LEC")).toBeNull();

    fireEvent.press(getByTestId("accordion-past-events"));

    expect(getByText("Career Fair LEC")).toBeTruthy();
  });

  it("shows event empty state when only classes are present", () => {
    const items: ScheduleItem[] = [
      makeItem("class-only", "COMP 248", hoursFromNow(1), hoursFromNow(2)),
    ];

    const { getByText } = render(<ScheduleCalendar items={items} />);

    expect(getByText("No upcoming events.")).toBeTruthy();
  });
});
