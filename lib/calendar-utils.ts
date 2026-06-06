/** ローカル日付を YYYYMMDD（slotChoices の dateKey と同形） */
export function dateKeyFromLocalDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}

export function isSameLocalCalendarDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** 表示用「2026年 4月」（Figma 寄せで月の前にスペース） */
export function formatYearMonthJa(d: Date): string {
  return `${d.getFullYear()}年 ${d.getMonth() + 1}月`;
}

/** 日曜始まり 6週 × 7 日 */
export function buildCalendarWeeks(visibleMonth: Date): { date: Date; inCurrentMonth: boolean }[][] {
  const year = visibleMonth.getFullYear();
  const month = visibleMonth.getMonth();
  const first = new Date(year, month, 1);
  const startPad = first.getDay();
  const gridStart = new Date(year, month, 1 - startPad);
  const cells: { date: Date; inCurrentMonth: boolean }[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    cells.push({
      date: d,
      inCurrentMonth: d.getMonth() === month,
    });
  }
  const weeks: { date: Date; inCurrentMonth: boolean }[][] = [];
  for (let w = 0; w < 6; w++) {
    weeks.push(cells.slice(w * 7, w * 7 + 7));
  }
  return weeks;
}

export function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export function addMonths(d: Date, delta: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + delta, 1);
}

export function compareDateKey(a: string, b: string): number {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

export function isDateKeyInRange(dateKey: string, fromDateKey: string, toDateKey: string): boolean {
  if (!/^\d{8}$/.test(dateKey) || !/^\d{8}$/.test(fromDateKey) || !/^\d{8}$/.test(toDateKey)) return false;
  return compareDateKey(dateKey, fromDateKey) >= 0 && compareDateKey(dateKey, toDateKey) <= 0;
}

export function parseDateKeyToLocalDate(dateKey: string): Date | null {
  if (!/^\d{8}$/.test(dateKey)) return null;
  const y = Number(dateKey.slice(0, 4));
  const m = Number(dateKey.slice(4, 6));
  const d = Number(dateKey.slice(6, 8));
  return new Date(y, m - 1, d);
}
