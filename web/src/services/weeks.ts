import { addDoc, collection, deleteDoc, getDocs, orderBy, query, where } from "firebase/firestore";
import { db } from "../firebase";
import type { Week } from "../types";

export async function listWeeks(termId?: string): Promise<Week[]> {
  const ref = collection(db, "weeks");
  const q = termId ? query(ref, where("termId", "==", termId), orderBy("weekNumber")) : query(ref, orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) } as Week));
}

export async function listWeeksForTerm(termId: string): Promise<Week[]> {
  if (!termId) return [];
  return listWeeks(termId);
}

async function deleteWeeksForTerm(termId: string) {
  const ref = collection(db, "weeks");
  const q = query(ref, where("termId", "==", termId));
  const snap = await getDocs(q);
  await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)));
}

export async function autoGenerateWeeksForTerm(termId: string, startDate: string, endDate: string): Promise<number> {
  await deleteWeeksForTerm(termId);

  const start = new Date(startDate);
  const end = new Date(endDate);
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);

  if (start > end) throw new Error("Invalid term date range.");

  const ref = collection(db, "weeks");
  let current = new Date(start);
  let weekNumber = 1;
  let created = 0;

  while (current <= end) {
    if (current.getDay() === 6) {
      current.setDate(current.getDate() + 2);
      continue;
    }
    if (current.getDay() === 0) {
      current.setDate(current.getDate() + 1);
      continue;
    }

    while (current.getDay() !== 1 && current > new Date(startDate)) {
      current.setDate(current.getDate() - 1);
    }

    const weekStart = new Date(current);
    const weekEnd = new Date(weekStart);
    while (weekEnd.getDay() !== 5) {
      weekEnd.setDate(weekEnd.getDate() + 1);
    }

    if (weekStart < start) weekStart.setTime(start.getTime());
    if (weekEnd > end) weekEnd.setTime(end.getTime());

    await addDoc(ref, {
      termId,
      weekNumber,
      startDate: weekStart.toISOString().slice(0, 10),
      endDate: weekEnd.toISOString().slice(0, 10),
      createdAt: new Date(),
    });

    created += 1;
    weekNumber += 1;
    current = new Date(weekEnd);
    current.setDate(current.getDate() + 3);
  }

  return created;
}
