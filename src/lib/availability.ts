import { addMinutes, isBefore } from "date-fns";
import { fromZonedTime, toZonedTime } from "date-fns-tz";

export type MinuteRange = { start: number; end: number };
export type BusyRange = { startsAt: Date; endsAt: Date };

export function intersectRanges(groups: MinuteRange[][]): MinuteRange[] {
  if (!groups.length) return [];
  return groups.reduce((current, next) => current.flatMap((a) => next.map((b) => ({
    start: Math.max(a.start, b.start), end: Math.min(a.end, b.end)
  })).filter((x) => x.start < x.end)));
}

export function calculateSlots(input: {
  date: string; timezone: string; windows: MinuteRange[]; busy: BusyRange[];
  durationMinutes: number; preparationMinutes: number; bufferMinutes: number;
  intervalMinutes: number; minimumNoticeMinutes: number; now?: Date;
}) {
  const now = input.now ?? new Date();
  const occupiedDuration = input.preparationMinutes + input.durationMinutes + input.bufferMinutes;
  const slots: { startsAt: Date; endsAt: Date }[] = [];
  for (const window of input.windows) {
    for (let minute = window.start; minute + occupiedDuration <= window.end; minute += input.intervalMinutes) {
      const localStart = `${input.date}T${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}:00`;
      const startsAt = fromZonedTime(localStart, input.timezone);
      const serviceStartsAt = addMinutes(startsAt, input.preparationMinutes);
      const endsAt = addMinutes(startsAt, occupiedDuration);
      if (isBefore(serviceStartsAt, addMinutes(now, input.minimumNoticeMinutes))) continue;
      const overlaps = input.busy.some((busy) => startsAt < busy.endsAt && endsAt > busy.startsAt);
      if (!overlaps) slots.push({ startsAt: serviceStartsAt, endsAt: addMinutes(serviceStartsAt, input.durationMinutes) });
    }
  }
  return slots;
}

export function weekdayInTimezone(date: string, timezone: string) {
  return toZonedTime(fromZonedTime(`${date}T12:00:00`, timezone), timezone).getDay();
}
