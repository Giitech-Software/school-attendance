// shared/services/terms.ts
import {
  collection,
  addDoc,
  doc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  query,
  orderBy,
} from "firebase/firestore";
import { db } from "../firebase";
import type { Term } from "../types";

const termsCollection = collection(db, "terms");

export async function createTerm(data: Omit<Term, "id">): Promise<Term> {
  try {
    const ref = await addDoc(termsCollection, {
      ...data,
      createdAt: serverTimestamp(),
    });
    return { id: ref.id, ...data } as Term;
  } catch (err: any) {
    console.error("createTerm error:", err.code ?? err);
    throw err;
  }
}

export async function getTermById(id: string): Promise<Term | null> {
  try {
    const snap = await getDoc(doc(db, "terms", id));
    if (!snap.exists()) return null;
    return { id: snap.id, ...(snap.data() as any) } as Term;
  } catch (err: any) {
    console.error("getTermById error:", err.code ?? err);
    throw err;
  }
}

export async function listTerms(): Promise<Term[]> {
  try {
    const q = query(termsCollection, orderBy("startDate", "desc"));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...(d.data() as any) } as Term));
  } catch (err: any) {
    console.error("listTerms error:", err.code ?? err);
    throw err;
  }
}

export async function updateTerm(id: string, patch: Partial<Term>): Promise<void> {
  try {
    await updateDoc(doc(db, "terms", id), {
      ...patch,
      updatedAt: serverTimestamp(),
    });
  } catch (err: any) {
    console.error("updateTerm error:", err.code ?? err);
    throw err;
  }
}

export async function deleteTerm(id: string): Promise<void> {
  try {
    await deleteDoc(doc(db, "terms", id));
  } catch (err: any) {
    console.error("deleteTerm error:", err.code ?? err);
    throw err;
  }
}

/** Get the current term (date inside start/end). Returns null if none. */
export async function getCurrentTerm(todayIso?: string): Promise<Term | null> {
  try {
    const today = todayIso ?? new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    // simple approach: query all terms and find the one containing today
    const snap = await getDocs(termsCollection);
    const terms = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) } as Term));
    return terms.find(t => t.startDate <= today && t.endDate >= today) ?? null;
  } catch (err: any) {
    console.error("getCurrentTerm error:", err.code ?? err);
    throw err;
  }
}
