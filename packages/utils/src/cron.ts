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
 * Search window for the next occurrence. 1500 days covers a full 4-year leap
 * cycle, so leap-day expressions such as `0 0 29 2 *` always have an
 * occurrence inside the window (they stay valid, and the scheduler's advance
 * can never write back a null nextRunAt for them). Expressions with no
 * occurrence inside the window (impossible dates like `0 0 30 2 *`) are
 * treated as invalid.
 */
const SEARCH_WINDOW_DAYS = 1500;

/**
 * Computes the next occurrence of a 5-field cron expression strictly after
 * `from`, in local time. Returns null when the expression is missing, is
 * malformed, or has no occurrence within the search window (see
 * SEARCH_WINDOW_DAYS).
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
  const windowEndMs = candidate.getTime() + SEARCH_WINDOW_DAYS * 24 * 60 * 60_000;
  while (candidate.getTime() <= windowEndMs) {
    // Standard cron semantics: day-of-month and day-of-week are AND-ed with
    // each other only when one of them is `*`. When both are constrained
    // (specific values, ranges, or lists) they are OR-ed: a candidate matches
    // if it satisfies either field. This matches Vixie cron and the common
    // cron documentation.
    const domMatches = isAllowed(day, candidate.getDate());
    const dowMatches = isAllowed(weekday, candidate.getDay());
    const domConstrained = day.size !== 31;
    const dowConstrained = weekday.size !== 7;
    const dayMatches =
      isAllowed(month, candidate.getMonth() + 1) &&
      (domConstrained && dowConstrained
        ? domMatches || dowMatches
        : domMatches && dowMatches);
    if (!dayMatches) {
      // The date predicates cannot change within a local day: fast-forward to
      // the next local midnight instead of stepping through 1440 minutes.
      candidate.setDate(candidate.getDate() + 1);
      candidate.setHours(0, 0, 0, 0);

      continue;
    }

    if (isAllowed(minute, candidate.getMinutes()) && isAllowed(hour, candidate.getHours())) {
      return new Date(candidate);
    }
    candidate.setMinutes(candidate.getMinutes() + 1);
  }

  return null;
};

/**
 * An expression is valid if and only if the parser can compute a next
 * occurrence from now. This intentionally rejects well-formed but
 * unsatisfiable expressions (impossible dates such as `0 0 30 2 *`); leap-day
 * expressions remain valid because the search window covers a full leap
 * cycle.
 */
export const isValidCronExpression = (expression: string): boolean =>
  getNextCronRunAt(expression, new Date()) !== null;
