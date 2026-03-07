// __tests__/ScheduleCalendar.test.tsx
import { render } from "@testing-library/react-native";
import React from "react";
import ScheduleCalendar from "../components/ScheduleCalendar";
import type { ScheduleItem } from "../utils/parseCourseEvents";

const d = (iso: string) => new Date(iso);

describe("components/ScheduleCalendar", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // ✅ Explicitly type `this` so TS doesn't complain
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

  it("renders empty state when items is empty", () => {
    const { getByText } = render(<ScheduleCalendar items={[]} />);
    expect(getByText("No schedule items to display.")).toBeTruthy();
  });

  it("renders course name, time range, and location for items", () => {
    const items: ScheduleItem[] = [
      {
        id: "1",
        courseName: "SOEN 321",
        start: d("2026-01-06T10:00:00Z"),
        end: d("2026-01-06T11:15:00Z"),
        location: "EV 3.123",
      },
    ];

    const { getByText } = render(<ScheduleCalendar items={items} />);

    expect(getByText("SOEN 321")).toBeTruthy();
    expect(getByText("EV 3.123")).toBeTruthy();
    expect(getByText("10:00 – 11:15")).toBeTruthy();
  });

  it("sorts items within the same day by start time", () => {
    const early: ScheduleItem = {
      id: "early",
      courseName: "Early Class",
      start: d("2026-01-06T08:00:00Z"),
      end: d("2026-01-06T09:00:00Z"),
      location: "Room A",
    };

    const late: ScheduleItem = {
      id: "late",
      courseName: "Late Class",
      start: d("2026-01-06T12:00:00Z"),
      end: d("2026-01-06T13:00:00Z"),
      location: "Room B",
    };

    const nextDay: ScheduleItem = {
      id: "next",
      courseName: "Next Day Class",
      start: d("2026-01-07T10:00:00Z"),
      end: d("2026-01-07T11:00:00Z"),
      location: "Room C",
    };

    const { getAllByText } = render(
      <ScheduleCalendar items={[late, nextDay, early]} />,
    );

    const sameDayTitles = getAllByText(/(Early Class|Late Class)/).map(
      (n) => n.props.children,
    );

    expect(sameDayTitles).toEqual(["Early Class", "Late Class"]);
  });

  it("renders multiple items (keyExtractor uses item.id) without crashing", () => {
    const items: ScheduleItem[] = [
      {
        id: "a",
        courseName: "Class A",
        start: d("2026-01-06T10:00:00Z"),
        end: d("2026-01-06T11:00:00Z"),
        location: "A",
      },
      {
        id: "b",
        courseName: "Class B",
        start: d("2026-01-06T12:00:00Z"),
        end: d("2026-01-06T13:00:00Z"),
        location: "B",
      },
    ];

    const { getByText } = render(<ScheduleCalendar items={items} />);
    expect(getByText("Class A")).toBeTruthy();
    expect(getByText("Class B")).toBeTruthy();
  });
});