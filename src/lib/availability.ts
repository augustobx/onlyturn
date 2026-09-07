import { addMinutes, isBefore } from "date-fns";
import { fromZonedTime, toZonedTime } from "date-fns-tz";

export type MinuteRange = { start: number; end: number };
export type BusyRange = { startsAt: Date; endsAt: Date };

function normalizeRanges(ranges: MinuteRange[]): MinuteRange[] {
  const sorted = ranges
    .filter((range) => range.start < range.end)
    .sort((a, b) => a.start - b.start || a.end - b.end);
  const merged: MinuteRange[] = [];
  for (const range of sorted) {
    const previous = merged.at(-1);
    if (!previous || range.start > previous.end) {
      merged.push({ ...range });
      continue;
    }
    previous.end = Math.max(previous.end, range.end);
  }
  return merged;
}

export function intersectRanges(groups: MinuteRange[][]): MinuteRange[] {
  if (!groups.length) return [];
  const normalizedGroups = groups.map(normalizeRanges).filter((group) => group.length);
  if (!normalizedGroups.length) return [];
  return normalizeRanges(normalizedGroups.reduce((current, next) => current.flatMap((a) => next.map((b) => ({
    start: Math.max(a.start, b.start), end: Math.min(a.end, b.end),
  })).filter((range) => range.start < range.end))));
}

export function calculateSlots(input: {
  date: string; timezone: string; windows: MinuteRange[]; busy: BusyRange[];
  durationMinutes: number; preparationMinutes: number; bufferMinutes: number;
  intervalMinutes: number; minimumNoticeMinutes: number; now?: Date;
}) {
  const now = input.now ?? new Date();
  const occupiedDuration = input.preparationMinutes + input.durationMinutes + input.bufferMinutes;
  const slots = new Map<number, { startsAt: Date; endsAt: Date }>();
  for (const window of normalizeRanges(input.windows)) {
    for (let minute = window.start; minute + occupiedDuration <= window.end; minute += input.intervalMinutes) {
      const localStart = `${input.date}T${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}:00`;
      const startsAt = fromZonedTime(localStart, input.timezone);
      const serviceStartsAt = addMinutes(startsAt, input.preparationMinutes);
      const endsAt = addMinutes(startsAt, occupiedDuration);
      if (isBefore(serviceStartsAt, addMinutes(now, input.minimumNoticeMinutes))) continue;
      const overlaps = input.busy.some((busy) => startsAt < busy.endsAt && endsAt > busy.startsAt);
      if (!overlaps) slots.set(serviceStartsAt.getTime(), { startsAt: serviceStartsAt, endsAt: addMinutes(serviceStartsAt, input.durationMinutes) });
    }
  }
  return [...slots.values()].sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
}

export function weekdayInTimezone(date: string, timezone: string) {
  return toZonedTime(fromZonedTime(`${date}T12:00:00`, timezone), timezone).getDay();
}
