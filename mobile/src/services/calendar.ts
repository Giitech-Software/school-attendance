import { getHolidaysInRange } from "./holidays";
import { listTerms } from "./terms";
import { getTenantScope } from "./tenantScope";

function datesBetween(start: string, end: string) {
  const result: string[] = [];
  const cursor = new Date(`${start}T12:00:00`);
  const last = new Date(`${end}T12:00:00`);
  while (cursor <= last) { result.push(cursor.toISOString().slice(0, 10)); cursor.setDate(cursor.getDate() + 1); }
  return result;
}

export async function getNonInstructionalDates(fromIso: string, toIso: string): Promise<Set<string>> {
  const result = new Set((await getHolidaysInRange(fromIso, toIso).catch(() => [])).map((holiday) => holiday.date));
  const terms = await listTerms().catch(() => []);
  const term = terms.find((item) => item.startDate <= fromIso && item.endDate >= toIso) ?? terms.find((item) => item.startDate <= toIso && item.endDate >= fromIso);
  if (term?.midtermStartDate && term?.midtermEndDate) datesBetween(term.midtermStartDate, term.midtermEndDate).forEach((date) => result.add(date));
  term?.holidays?.forEach((holiday) => { if (holiday.date >= fromIso && holiday.date <= toIso) result.add(holiday.date); });
  const scope = await getTenantScope();
  if (scope.tenantType !== "school") {
    const country = scope.countryCode || "GH";
    try {
      const years = [...new Set([fromIso.slice(0, 4), toIso.slice(0, 4)])];
      const responses = await Promise.all(years.map((year) => fetch(`https://date.nager.at/api/v3/PublicHolidays/${year}/${country}`).then((response) => response.ok ? response.json() : []).catch(() => [])));
      responses.flat().forEach((holiday: any) => { const date = String(holiday.date ?? "").slice(0, 10); if (date >= fromIso && date <= toIso) result.add(date); });
    } catch { /* best effort; local holidays remain available offline */ }
  }
  return result;
}
