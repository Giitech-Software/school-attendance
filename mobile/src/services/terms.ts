import { db } from "../../app/firebase";
import { collection, doc, getDoc, getDocs, addDoc, updateDoc, deleteDoc, query, where } from "firebase/firestore";
import type { Term } from "./types";
import { logAdminAction } from "./adminLogs";
import { belongsToTenant, getTenantScope, tenantConstraints, withTenantScope } from "./tenantScope";

const col = collection(db, "terms");
const weeksCol = collection(db, "weeks");

function sortTerms(rows: Term[]) {
  return [...rows].sort((a, b) => String(b.startDate ?? "").localeCompare(String(a.startDate ?? "")));
}

export async function listTerms(): Promise<Term[]> {
  const scope = await getTenantScope();
  const snap = await getDocs(query(col, ...tenantConstraints(scope)));
  return sortTerms(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Term, "id">) })));
}

export async function getTerm(id: string): Promise<Term> {
  const ref = doc(db, "terms", id);
  const snap = await getDoc(ref);
  if (!snap.exists() || !belongsToTenant(snap.data(), await getTenantScope())) throw new Error("Term not found");
  return { id: snap.id, ...(snap.data() as Omit<Term, "id">) };
}

export async function getCurrentTerm(): Promise<Term | null> {
  const terms = await listTerms();
  return terms.find((term) => term.isCurrent) ?? null;
}

export async function createTerm(data: Omit<Term, "id">): Promise<{ id: string }> {
  const ref = await addDoc(col, withTenantScope({ ...data, isCurrent: false, createdAt: new Date() }, await getTenantScope()));
  await logAdminAction({ action: "CREATE_TERM", targetType: "term", targetId: ref.id, description: `Created term ${data.name}` });
  return { id: ref.id };
}

export async function updateTerm(id: string, data: Partial<Term>) {
  const ref = doc(db, "terms", id);
  await updateDoc(ref, withTenantScope({ ...data, updatedAt: new Date() }, await getTenantScope()));
  await logAdminAction({ action: "UPDATE_TERM", targetType: "term", targetId: id, description: `Updated term ${data.name ?? id}` });
}

export async function setCurrentTerm(termId: string) {
  const scope = await getTenantScope();
  const snap = await getDocs(query(col, ...tenantConstraints(scope)));
  const updates = snap.docs.map((d) => updateDoc(d.ref, { isCurrent: d.id === termId }));
  await Promise.all(updates);
  await logAdminAction({ action: "SET_CURRENT_TERM", targetType: "term", targetId: termId, description: "Set current term" });
}

export async function deleteTerm(id: string) {
  const ref = doc(db, "terms", id);
  await deleteDoc(ref);
  const scope = await getTenantScope();
  const weeksSnap = await getDocs(query(weeksCol, where("termId", "==", id), ...tenantConstraints(scope)));
  await Promise.all(weeksSnap.docs.map((d) => deleteDoc(d.ref)));
  await logAdminAction({ action: "DELETE_TERM", targetType: "term", targetId: id, description: "Deleted term" });
}
