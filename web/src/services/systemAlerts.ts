import { addDoc, collection, doc, getDocs, query, serverTimestamp, updateDoc, where } from "firebase/firestore";
import { db } from "../firebase";
import { auth } from "../firebase";
import { getTenantScope, withTenantScope } from "./tenantScope";

export type SystemAlert = { id?: string; title: string; body: string; startsAt?: string; endsAt?: string | null; createdAt?: unknown; tenantId?: string | null };

export async function createSystemAlert(input: Pick<SystemAlert, "title" | "body" | "endsAt">) {
  const scope = await getTenantScope();
  if (!scope.isSuperAdmin || !auth.currentUser) throw new Error("Super Admin permission is required.");
  await addDoc(collection(db, "systemAlerts"), withTenantScope({ ...input, active: true, senderUid: auth.currentUser.uid, createdAt: serverTimestamp(), startsAt: new Date().toISOString() }, scope));
}

export async function getActiveSystemAlerts() {
  const scope = await getTenantScope();
  const snap = await getDocs(query(collection(db, "systemAlerts"), where("active", "==", true)));
  const now = Date.now();
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) } as SystemAlert)).filter((alert) => (!alert.tenantId || alert.tenantId === scope.tenantId) && (!alert.endsAt || new Date(alert.endsAt).getTime() >= now));
}

export async function listSystemAlerts(): Promise<SystemAlert[]> {
  const scope = await getTenantScope();
  if (!scope.isSuperAdmin) throw new Error("Super Admin permission is required.");
  const snap = await getDocs(query(collection(db, "systemAlerts"), where("senderUid", "==", auth.currentUser?.uid)));
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) } as SystemAlert));
}

export async function updateSystemAlert(id: string, input: Pick<SystemAlert, "title" | "body" | "endsAt">) {
  const scope = await getTenantScope();
  if (!scope.isSuperAdmin) throw new Error("Super Admin permission is required.");
  await updateDoc(doc(db, "systemAlerts", id), { title: input.title.trim(), body: input.body.trim(), endsAt: input.endsAt });
}
export async function setSystemAlertActive(id: string, active: boolean) { const scope = await getTenantScope(); if (!scope.isSuperAdmin) throw new Error("Super Admin permission is required."); await updateDoc(doc(db, "systemAlerts", id), { active }); }
