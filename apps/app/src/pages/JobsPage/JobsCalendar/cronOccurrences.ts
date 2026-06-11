const HOURS_IN_DAY = 24;

const matchesField = (field: string, value: number): boolean => {
  if (field === "*") {
    return true;
  }
  for (const part of field.split(",")) {
    const range = /^(\d+)-(\d+)$/.exec(part);
    if (range) {
      if (value >= Number(range[1]) && value <= Number(range[2])) {
        return true;
      }
      continue;
    }
    if (Number(part) === value) {
      return true;
    }
  }

  return false;
};

/**
 * Lightweight cron expansion for the week calendar: returns the times-of-day a
 * `min hour day month weekday` expression fires on the given day. Unsupported
 * field shapes simply produce no occurrences (the calendar is a preview, the
 * scheduler remains the source of truth).
 */
export const cronOccurrencesForDay = (cron: string, day: Date): Date[] => {
  const parts = cron.trim().split(/\s+/);
  if (parts.length !== 5) {
    return [];
  }
  const [minutePart, hourPart, dayPart, monthPart, weekdayPart] = parts;
  if (
    !matchesField(weekdayPart, day.getDay()) ||
    !matchesField(monthPart, day.getMonth() + 1) ||
    !matchesField(dayPart, day.getDate())
  ) {
    return [];
  }
  const minute = minutePart === "*" ? 0 : Number(minutePart.split(",")[0]);
  if (Number.isNaN(minute)) {
    return [];
  }

  const occurrences: Date[] = [];
  for (let hour = 0; hour < HOURS_IN_DAY; hour += 1) {
    if (!matchesField(hourPart, hour)) {
      continue;
    }
    const at = new Date(day);
    at.setHours(hour, minute, 0, 0);
    occurrences.push(at);
  }

  return occurrences;
};
