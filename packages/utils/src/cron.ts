/**
 * Self-built 5-field cron parsing (minute, hour, day-of-month, month,
 * day-of-week). This module is the single source of truth for cron validity:
 * schema validation and the routine scheduler both consider an expression
 * valid if and only if a next occurrence can be computed.
 *
 * Time semantics: expressions are interpreted in the server's local timezone.
 * The next occurrence is found by scanning strictly forward in UTC minutes and
 * matching each candidate's local time fields. Around DST transitions this
 * keeps the returned instant strictly later than `from`: repeated fall-back
 * wall times are distinct occurrences, and spring-forward gaps are skipped.
 */

type CronField = {
  values: ReadonlySet<number>;
  wildcard: boolean;
};

const fullRange = (min: number, max: number): number[] =>
  Array.from({ length: max - min + 1 }, (_, index) => min + index);

const withStep = (values: number[], base: number, step: number): number[] =>
  values.filter((value) => (value - base) % step === 0);

const makeField = (values: Iterable<number>, wildcard: boolean): CronField => ({
  values: new Set(values),
  wildcard,
});

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
    const merged = parts.reduce<{ values: Set<number>; wildcard: boolean } | null>(
      (acc, part) => {
        if (!acc) return null;
        const sub = parseCronField(part, min, max);
        if (!sub) return null;
        for (const value of sub.values) acc.values.add(value);

        return { values: acc.values, wildcard: acc.wildcard || sub.wildcard };
      },
      { values: new Set<number>(), wildcard: false },
    );

    return merged ? makeField(merged.values, merged.wildcard) : null;
  }

  if (field === "*") {
    return makeField(fullRange(min, max), true);
  }

  // `*/n`: the full range with a step.
  const stepAllMatch = /^\*\/(\d+)$/.exec(field);
  if (stepAllMatch) {
    const step = Number(stepAllMatch[1]);
    if (!Number.isInteger(step) || step <= 0) return null;

    return makeField(withStep(fullRange(min, max), min, step), true);
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

    return makeField(withStep(fullRange(start, end), start, step), false);
  }

  const value = Number(field);
  if (!Number.isInteger(value) || value < min || value > max) return null;

  return makeField([value], false);
};

// Standard cron accepts both 0 and 7 for Sunday; normalize 7 to 0 so ranges
// like `5-7` (Fri-Sun) and plain `7` behave as expected.
const parseWeekdayField = (field: string): CronField | null => {
  const parsed = parseCronField(field, 0, 7);
  if (!parsed) return null;

  return makeField(
    [...parsed.values].map((value) => (value === 7 ? 0 : value)),
    parsed.wildcard,
  );
};

const isAllowed = (field: CronField, value: number) => field.values.has(value);

const startOfNextMinute = (from: Date) => {
  return new Date(Math.floor(from.getTime() / 60_000) * 60_000 + 60_000);
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
    const domConstrained = !day.wildcard;
    const dowConstrained = !weekday.wildcard;
    const dayMatches =
      isAllowed(month, candidate.getMonth() + 1) &&
      (domConstrained && dowConstrained ? domMatches || dowMatches : domMatches && dowMatches);
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
    candidate.setTime(candidate.getTime() + 60_000);
  }

  return null;
};

/**
 * Expands a cron range into at most one representative occurrence per local
 * hour. High-frequency expressions therefore stay bounded for calendar UIs,
 * while `aggregated` tells callers that the hour contains additional runs.
 */
export const getCronOccurrenceBuckets = (
  expression: string | null,
  from: Date,
  to: Date,
  limit = 200,
) => {
  const buckets: Array<{ aggregated: boolean; at: Date }> = [];
  if (to <= from || limit <= 0) return buckets;

  const cursor = new Date(from.getTime() - 60_000);
  while (buckets.length < limit) {
    const at = getNextCronRunAt(expression, cursor);
    if (!at || at >= to) break;
    if (at < from) {
      cursor.setTime(at.getTime());
      continue;
    }

    const endOfHour = new Date(at);
    endOfHour.setHours(endOfHour.getHours() + 1, 0, 0, 0);
    const next = getNextCronRunAt(expression, at);
    buckets.push({
      aggregated: next !== null && next < endOfHour && next < to,
      at,
    });
    cursor.setTime(Math.min(endOfHour.getTime(), to.getTime()) - 60_000);
  }

  return buckets;
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
