import { listTerms } from "./terms";
import { listWeeks } from "./weeks";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export async function getCurrentTerm() {
  const today = todayISO();
  const terms = await listTerms();

  return terms.find(
    t => today >= t.startDate && today <= t.endDate
  ) ?? null;
}

export async function getCurrentWeek() {
  const today = todayISO();
  const weeks = await listWeeks();

  return weeks.find(
    w => today >= w.startDate && today <= w.endDate
  ) ?? null;
}
