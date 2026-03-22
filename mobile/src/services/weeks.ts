// src/services/weeks.ts
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  deleteDoc,
  orderBy,
} from "firebase/firestore";
import { db } from "../../app/firebase";

/* =========================
   LIST WEEKS (LEGACY SAFE)
========================= */
export async function listWeeks(termId?: string): Promise<any[]> {
  const ref = collection(db, "weeks");

  let q;

  if (termId) {
    q = query(
      ref,
      where("termId", "==", termId),
      orderBy("weekNumber")
    );
  } else {
    // legacy fallback (do NOT mix terms)
    q = query(ref, orderBy("createdAt", "desc"));
  }

  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

/* =========================
   LIST WEEKS FOR TERM (STRICT)
========================= */
export async function listWeeksForTerm(termId: string): Promise<any[]> {
  if (!termId) return [];

  const ref = collection(db, "weeks");
  const q = query(
    ref,
    where("termId", "==", termId),
    orderBy("weekNumber")
  );

  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

/* =========================
   DELETE WEEKS FOR TERM
========================= */
async function deleteWeeksForTerm(termId: string) {
  const ref = collection(db, "weeks");
  const q = query(ref, where("termId", "==", termId));
  const snap = await getDocs(q);

  const deletions = snap.docs.map(d =>
    deleteDoc(d.ref)
  );

  await Promise.all(deletions);
}

/* =========================
   AUTO-GENERATE WEEKS
========================= */
export async function autoGenerateWeeksForTerm(
  termId: string,
  startDate: string,
  endDate: string
): Promise<number> {
  await deleteWeeksForTerm(termId);

  const start = new Date(startDate);
  const end = new Date(endDate);

  if (start > end) {
    throw new Error("Invalid term date range");
  }

  const ref = collection(db, "weeks");

  let current = new Date(start);
  let weekNumber = 1;
  let created = 0;

 while (current <= end) {
  // ⛔ Skip weekends
  if (current.getDay() === 6) {
    current.setDate(current.getDate() + 2);
    continue;
  }
  if (current.getDay() === 0) {
    current.setDate(current.getDate() + 1);
    continue;
  }

  // ✅ Force week start = Monday
  while (current.getDay() !== 1 && current > new Date(startDate)) {
  current.setDate(current.getDate() - 1);
}

  const weekStart = new Date(current);

  // ✅ Force week end = Friday
  const weekEnd = new Date(weekStart);
  while (weekEnd.getDay() !== 5) {
    weekEnd.setDate(weekEnd.getDate() + 1);
  }

  // clamp inside term
  if (weekStart < start) {
    weekStart.setTime(start.getTime());
  }
  if (weekEnd > end) {
    weekEnd.setTime(end.getTime());
  }

  await addDoc(ref, {
    termId,
    weekNumber,
    startDate: weekStart.toISOString().slice(0, 10),
    endDate: weekEnd.toISOString().slice(0, 10),
    createdAt: new Date(),
  });

  created++;
  weekNumber++;

  // ➡️ move to next Monday
  current = new Date(weekEnd);
  current.setDate(current.getDate() + 3);
}


  return created;
}
 