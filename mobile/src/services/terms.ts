import { db } from "../../app/firebase";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
} from "firebase/firestore";
import type { Term } from "./types";

const col = collection(db, "terms");
const weeksCol = collection(db, "weeks");

/* =========================
   LIST TERMS
========================= */
export async function listTerms(): Promise<Term[]> {
  const snap = await getDocs(col);
  return snap.docs.map((d) => ({
    id: d.id,
    ...(d.data() as Omit<Term, "id">),
  }));
}

/* =========================
   GET SINGLE TERM
========================= */
export async function getTerm(id: string): Promise<Term> {
  const ref = doc(db, "terms", id);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    throw new Error("Term not found");
  }

  return {
    id: snap.id,
    ...(snap.data() as Omit<Term, "id">),
  };
}

/* =========================
   GET CURRENT TERM
========================= */
export async function getCurrentTerm(): Promise<Term | null> {
  const snap = await getDocs(col);

  for (const d of snap.docs) {
    const data = d.data() as Term;
    if (data.isCurrent) {
      return { id: d.id, ...data };
    }
  }

  return null;
}

/* =========================
   CREATE TERM
========================= */
export async function createTerm(
  data: Omit<Term, "id">
): Promise<{ id: string }> {
  const ref = await addDoc(col, {
    ...data,
    isCurrent: false, // default new term is not current
    createdAt: new Date(),
  });

  return { id: ref.id };
}

/* =========================
   UPDATE TERM
========================= */
export async function updateTerm(
  id: string,
  data: Omit<Term, "id">
) {
  const ref = doc(db, "terms", id);
  await updateDoc(ref, {
    ...data,
    updatedAt: new Date(),
  });
}

/* =========================
   SET CURRENT TERM
========================= */
export async function setCurrentTerm(termId: string) {
  const snap = await getDocs(col);

  for (const d of snap.docs) {
    await updateDoc(d.ref, {
      isCurrent: d.id === termId,
      updatedAt: new Date(),
    });
  }
}

/* =========================
   DELETE TERM + CLEAN WEEKS
========================= */
async function deleteWeeksForTerm(termId: string) {
  const q = query(weeksCol, where("termId", "==", termId));
  const snap = await getDocs(q);

  const deletions = snap.docs.map((d) => deleteDoc(d.ref));
  await Promise.all(deletions);
}

export async function deleteTerm(id: string) {
  // 1️⃣ Delete all weeks associated with this term
  await deleteWeeksForTerm(id);

  // 2️⃣ Delete the term itself
  const ref = doc(db, "terms", id);
  await deleteDoc(ref);
}
