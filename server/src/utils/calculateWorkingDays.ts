/**
 * Interface representing a holiday record from database or config
 */
export interface UniversityHoliday {
  date: Date | string; // e.g. "2026-10-01" (Independence Day)
  name: string;        // e.g. "National Independence Day"
  isObserved?: boolean;
}

export interface WorkingDaysResult {
  workingDays: number;
  totalDays: number;
  weekendDaysExcluded: number;
  holidaysExcluded: number;
  excludedDates: Array<{ date: string; reason: 'WEEKEND' | 'HOLIDAY'; name?: string }>;
}

/**
 * Normalizes a Date object to YYYY-MM-DD string key in UTC
 */
export function toDateKey(date: Date | string): string {
  const d = new Date(date);
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Default statutory national holidays for Nigeria (fallback if DB has none)
 */
export const DEFAULT_STATUTORY_HOLIDAYS_2026: UniversityHoliday[] = [
  { date: '2026-01-01', name: "New Year's Day" },
  { date: '2026-04-03', name: 'Good Friday' },
  { date: '2026-04-06', name: 'Easter Monday' },
  { date: '2026-05-01', name: "Workers' Day" },
  { date: '2026-05-27', name: "Children's Day" },
  { date: '2026-06-12', name: 'Democracy Day' },
  { date: '2026-10-01', name: 'National Independence Day' },
  { date: '2026-12-25', name: 'Christmas Day' },
  { date: '2026-12-26', name: 'Boxing Day' },
];

/**
 * Calculates net working days between startDate and endDate (inclusive),
 * strictly excluding weekends (Saturday/Sunday) and official institutional holidays.
 *
 * @param startDate - Starting date of the leave
 * @param endDate - Ending date of the leave
 * @param holidayList - Array of registered university/statutory holidays
 */
export function calculateWorkingDays(
  startDate: Date | string,
  endDate: Date | string,
  holidayList: UniversityHoliday[] = []
): WorkingDaysResult {
  const start = new Date(startDate);
  const end = new Date(endDate);

  // Normalize hours to midnight UTC
  const current = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()));
  const stop = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()));

  if (current.getTime() > stop.getTime()) {
    throw new Error('Invalid date range: startDate cannot be after endDate.');
  }

  // Pre-index holidays in a Map for O(1) constant-time lookup
  const holidayMap = new Map<string, string>();
  for (const h of holidayList) {
    if (h.isObserved !== false) {
      const key = toDateKey(h.date);
      holidayMap.set(key, h.name);
    }
  }

  let workingDays = 0;
  let totalDays = 0;
  let weekendDaysExcluded = 0;
  let holidaysExcluded = 0;
  const excludedDates: WorkingDaysResult['excludedDates'] = [];

  // Iterate day-by-day across the requested window
  while (current.getTime() <= stop.getTime()) {
    totalDays++;
    const dayOfWeek = current.getUTCDay(); // 0 = Sunday, 6 = Saturday
    const dateKey = toDateKey(current);

    if (dayOfWeek === 0 || dayOfWeek === 6) {
      // Exclude Saturday or Sunday
      weekendDaysExcluded++;
      excludedDates.push({
        date: dateKey,
        reason: 'WEEKEND',
      });
    } else if (holidayMap.has(dateKey)) {
      // Exclude statutory or institutional holiday falling on a weekday
      holidaysExcluded++;
      excludedDates.push({
        date: dateKey,
        reason: 'HOLIDAY',
        name: holidayMap.get(dateKey),
      });
    } else {
      // Valid working day
      workingDays++;
    }

    // Advance by 1 day
    current.setUTCDate(current.getUTCDate() + 1);
  }

  return {
    workingDays,
    totalDays,
    weekendDaysExcluded,
    holidaysExcluded,
    excludedDates,
  };
}
