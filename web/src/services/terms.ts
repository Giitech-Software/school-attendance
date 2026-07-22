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
import { belongsToTenant, getTenantScope, tenantConstraints, withTenantScope } from "./tenantScope";

export type { Term };

const termsCollection = collection(db, "terms");

function sortTerms(rows: Term[]) {
  return [...rows].sort((a, b) => String(b.startDate ?? "").localeCompare(String(a.startDate ?? "")));
}

export async function createTerm(data: Omit<Term, "id">): Promise<Term> {
  try {
    const ref = await addDoc(termsCollection, withTenantScope({
      ...data,
      createdAt: serverTimestamp(),
    }, await getTenantScope()));
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
    const data = snap.data();
    if (!belongsToTenant(data, await getTenantScope())) return null;
    return { id: snap.id, ...(data as any) } as Term;
  } catch (err: any) {
    console.error("getTermById error:", err.code ?? err);
    throw err;
  }
}

export async function listTerms(): Promise<Term[]> {
  try {
    const scope = await getTenantScope();
    const q = scope.isScoped ? query(termsCollection, ...tenantConstraints(scope)) : query(termsCollection, orderBy("startDate", "desc"));
    const snap = await getDocs(q);
    return sortTerms(snap.docs.map(d => ({ id: d.id, ...(d.data() as any) } as Term)));
  } catch (err: any) {
    console.error("listTerms error:", err.code ?? err);
    throw err;
  }
}

export async function updateTerm(id: string, patch: Partial<Term>): Promise<void> {
  try {
    await updateDoc(doc(db, "terms", id), withTenantScope({
      ...patch,
      updatedAt: serverTimestamp(),
    }, await getTenantScope()));
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

export async function getCurrentTerm(todayIso?: string): Promise<Term | null> {
  try {
    const today = todayIso ?? new Date().toISOString().slice(0, 10);
    const terms = await listTerms();
    return terms.find(t => t.isCurrent) ?? terms.find(t => t.startDate <= today && t.endDate >= today) ?? null;
  } catch (err: any) {
    console.error("getCurrentTerm error:", err.code ?? err);
    throw err;
  }
}
