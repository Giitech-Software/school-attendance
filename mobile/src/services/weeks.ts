import { addDoc, collection, deleteDoc, getDocs, query, where } from "firebase/firestore";
import { db } from "../../app/firebase";
import { getTenantScope, sortByCreatedAtDesc, tenantConstraints, withTenantScope } from "./tenantScope";

export async function listWeeks(termId?: string): Promise<any[]> {
  const scope = await getTenantScope();
  const ref = collection(db, "weeks");
  const filters = termId ? [where("termId", "==", termId), ...tenantConstraints(scope)] : tenantConstraints(scope);
  const snap = await getDocs(query(ref, ...filters));
  const rows: any[] = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  return termId ? rows.sort((a, b) => (a.weekNumber ?? 0) - (b.weekNumber ?? 0)) : sortByCreatedAtDesc(rows);
}

export async function listWeeksForTerm(termId: string): Promise<any[]> {
  if (!termId) return [];
  return listWeeks(termId);
}

async function deleteWeeksForTerm(termId: string) {
  const scope = await getTenantScope();
  const ref = collection(db, "weeks");
  const snap = await getDocs(query(ref, where("termId", "==", termId), ...tenantConstraints(scope)));
  await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)));
}

export async function autoGenerateWeeksForTerm(termId: string, startDate: string, endDate: string): Promise<number> {
  await deleteWeeksForTerm(termId);
  const start = new Date(startDate);
  const end = new Date(endDate);
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  if (start > end) throw new Error("Invalid term date range");

  const scope = await getTenantScope();
  const ref = collection(db, "weeks");
  let current = new Date(start);
  let weekNumber = 1;
  let created = 0;

  while (current <= end) {
    if (current.getDay() === 6) { current.setDate(current.getDate() + 2); continue; }
    if (current.getDay() === 0) { current.setDate(current.getDate() + 1); continue; }
    while (current.getDay() !== 1 && current > new Date(startDate)) current.setDate(current.getDate() - 1);
    const weekStart = new Date(current);
    const weekEnd = new Date(weekStart);
    while (weekEnd.getDay() !== 5) weekEnd.setDate(weekEnd.getDate() + 1);
    if (weekStart < start) weekStart.setTime(start.getTime());
    if (weekEnd > end) weekEnd.setTime(end.getTime());

    await addDoc(ref, withTenantScope({
      termId,
      weekNumber,
      startDate: weekStart.toISOString().slice(0, 10),
      endDate: weekEnd.toISOString().slice(0, 10),
      createdAt: new Date(),
    }, scope));

    created += 1;
    weekNumber += 1;
    current = new Date(weekEnd);
    current.setDate(current.getDate() + 3);
  }
  return created;
}

