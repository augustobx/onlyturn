import { describe, expect, it } from "vitest";
import { calculateSlots, intersectRanges } from "./availability";

describe("availability engine", () => {
  it("intersects tenant, location and assignee windows", () => {
    expect(intersectRanges([[{start:480,end:1200}],[{start:540,end:1080}],[{start:600,end:900}]])).toEqual([{start:600,end:900}]);
  });

  it("normalizes duplicated and overlapping windows before calculating", () => {
    expect(intersectRanges([
      [{ start: 540, end: 720 }, { start: 540, end: 720 }, { start: 690, end: 780 }],
      [{ start: 600, end: 750 }],
    ])).toEqual([{ start: 600, end: 750 }]);
  });

  it("never returns duplicate slots when windows overlap", () => {
    const slots = calculateSlots({
      date: "2026-08-31",
      timezone: "UTC",
      windows: [{ start: 540, end: 660 }, { start: 540, end: 660 }, { start: 600, end: 720 }],
      busy: [],
      durationMinutes: 30,
      preparationMinutes: 0,
      bufferMinutes: 0,
      intervalMinutes: 30,
      minimumNoticeMinutes: 0,
      now: new Date("2026-08-01T00:00:00Z"),
    });
    expect(slots.map((slot) => slot.startsAt.toISOString())).toEqual([
      "2026-08-31T09:00:00.000Z",
      "2026-08-31T09:30:00.000Z",
      "2026-08-31T10:00:00.000Z",
      "2026-08-31T10:30:00.000Z",
      "2026-08-31T11:00:00.000Z",
      "2026-08-31T11:30:00.000Z",
    ]);
  });

  it("excludes overlapping bookings and respects buffers", () => {
    const slots=calculateSlots({date:"2026-08-31",timezone:"America/Argentina/Buenos_Aires",windows:[{start:540,end:720}],busy:[{startsAt:new Date("2026-08-31T13:00:00.000Z"),endsAt:new Date("2026-08-31T13:30:00.000Z")}],durationMinutes:30,preparationMinutes:0,bufferMinutes:15,intervalMinutes:30,minimumNoticeMinutes:0,now:new Date("2026-08-01T00:00:00Z")});
    expect(slots.map(s=>s.startsAt.toISOString())).toEqual(["2026-08-31T12:00:00.000Z","2026-08-31T13:30:00.000Z","2026-08-31T14:00:00.000Z"]);
  });

  it("does not create a slot that extends beyond a window", () => {
    const slots=calculateSlots({date:"2026-08-31",timezone:"UTC",windows:[{start:540,end:600}],busy:[],durationMinutes:60,preparationMinutes:15,bufferMinutes:0,intervalMinutes:15,minimumNoticeMinutes:0,now:new Date("2026-08-01T00:00:00Z")});
    expect(slots).toHaveLength(0);
  });
});
