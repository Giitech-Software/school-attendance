//mobile/src/utils/dateRanges.ts
export function getMonthRange(year: number, monthIndex: number) {
  // monthIndex: 0 = Jan, 11 = Dec
  const from = new Date(year, monthIndex, 1);
  const to = new Date(year, monthIndex + 1, 0);

  const toIso = (d: Date) => d.toISOString().slice(0, 10);

  return {
    fromIso: toIso(from),
    toIso: toIso(to),
    label: from.toLocaleString("default", { month: "long", year: "numeric" }),
  };
}
// utils/dateRanges.ts
export function intersectRanges(
  aFrom: string,
  aTo: string,
  bFrom: string,
  bTo: string
) {
  const from = aFrom > bFrom ? aFrom : bFrom;
  const to   = aTo   < bTo   ? aTo   : bTo;
  return from <= to ? { fromIso: from, toIso: to } : null;
}
