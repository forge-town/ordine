/**
 * Self-built 5-field cron parsing (minute, hour, day-of-month, month,
 * day-of-week). This module is the single source of truth for cron validity:
 * schema validation and the routine scheduler both consider an expression
 * valid if and only if a next occurrence can be computed.
 *
 * Time semantics: expressions are interpreted in the server's local timezone.
 * The next occurrence is found by scanning forward minute by minute, and
 * repeated or nonexistent local times around DST transitions follow the
 * ECMAScript disambiguation rules (the earlier UTC instant is chosen), so a
 * fall-back transition does not produce a double run and a spring-forward
 * gap simply rolls forward to the next valid local time.
 */

type CronField = ReadonlySet<number>;

const fullRange = (min: number, max: number): number[] =>
  Array.from({ length: max - min + 1 }, (_, index) => min + index);

const withStep = (values: number[], base: number, step: number): number[] =>
  values.filter((value) => (value - base) % step === 0);

/**
 * Parses a single cron field. Supported syntax: `*`, `*​/n`, a single value
 * `5`, a range `1-5`, a stepped range `1-5/2`, and comma lists (`1,3,5`,
 * `0-2,4`) whose segments are parsed recursively and merged. Malformed or
 * out-of-range input returns null, which callers treat as "invalid".
 */
const parseCronField = (field: string, min: number, max: number): CronField | null => {
  // Comma list: parse each segment and merge; any invalid segment invalidates the whole field.
  if (field.includes(",")) {
    const parts = field.split(",");
    const merged = new Set<number>();
    for (const part of parts) {
      const sub = parseCronField(part, min, max);
      if (!sub) return null;
      for (const value of sub) merged.add(value);
    }

    return merged;
  }

  if (field === "*") {
    return new Set(fullRange(min, max));
  }

  // `*/n`: the full range with a step.
  const stepAllMatch = /^\*\/(\d+)$/.exec(field);
  if (stepAllMatch) {
    const step = Number(stepAllMatch[1]);
    if (!Number.isInteger(step) || step <= 0) return null;

    return new Set(withStep(fullRange(min, max), min, step));
  }

  // Range `a-b` and stepped range `a-b/n`.
  const rangeMatch = /^(\d+)-(\d+)(?:\/(\d+))?$/.exec(field);
  if (rangeMatch) {
    const start = Number(rangeMatch[1]);
    const end = Number(rangeMatch[2]);
    const step = rangeMatch[3] === undefined ? 1 : Number(rangeMatch[3]);
    if (
      !Number.isInteger(start) ||
      !Number.isInteger(end) ||
      !Number.isInteger(step) ||
      step <= 0 ||
      start < min ||
      end > max ||
      start > end
    ) {
      return null;
    }

    return new Set(withStep(fullRange(start, end), start, step));
  }

  const value = Number(field);
  if (!Number.isInteger(value) || value < min || value > max) return null;

  return new Set([value]);
};

// Standard cron accepts both 0 and 7 for Sunday; normalize 7 to 0 so ranges
// like `5-7` (Fri-Sun) and plain `7` behave as expected.
const parseWeekdayField = (field: string): CronField | null => {
  const parsed = parseCronField(field, 0, 7);
  if (!parsed) return null;

  return new Set([...parsed].map((value) => (value === 7 ? 0 : value)));
};

const isAllowed = (field: CronField, value: number) => field.has(value);

const startOfNextMinute = (from: Date) => {
  const next = new Date(from);
  next.setSeconds(0, 0);
  next.setMinutes(next.getMinutes() + 1);

  return next;
};

/**
 * Computes the next occurrence of a 5-field cron expression strictly after
 * `from`, in local time. Returns null when the expression is missing, is
 * malformed, or has no occurrence within the 366-day search window (e.g.
 * `0 0 30 2 *`).
 */
export const getNextCronRunAt = (expression: string | null, from: Date): Date | null => {
  if (!expression) return null;

  const parts = expression.trim().split(/\s+/);
  if (parts.length !== 5) return null;

  const [minuteExpr, hourExpr, dayExpr, monthExpr, weekdayExpr] = parts;
  const minute = parseCronField(minuteExpr!, 0, 59);
  const hour = parseCronField(hourExpr!, 0, 23);
  const day = parseCronField(dayExpr!, 1, 31);
  const month = parseCronField(monthExpr!, 1, 12);
  const weekday = parseWeekdayField(weekdayExpr!);
  if (!minute || !hour || !day || !month || !weekday) return null;

  const candidate = startOfNextMinute(from);
  const maxIterations = 366 * 24 * 60;
  for (const _ of Array.from({ length: maxIterations })) {
    if (
      isAllowed(minute, candidate.getMinutes()) &&
      isAllowed(hour, candidate.getHours()) &&
      isAllowed(day, candidate.getDate()) &&
      isAllowed(month, candidate.getMonth() + 1) &&
      isAllowed(weekday, candidate.getDay())
    ) {
      return new Date(candidate);
    }
    candidate.setMinutes(candidate.getMinutes() + 1);
  }

  return null;
};

/**
 * An expression is valid if and only if the parser can compute a next
 * occurrence from now. This intentionally rejects well-formed but
 * unsatisfiable expressions (impossible dates, or dates outside the 366-day
 * window such as a leap day more than a year away).
 */
export const isValidCronExpression = (expression: string): boolean =>
  getNextCronRunAt(expression, new Date()) !== null;
