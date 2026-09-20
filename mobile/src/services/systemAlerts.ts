import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../../app/firebase";
import { getTenantScope } from "./tenantScope";

export type SystemAlert = { id: string; title: string; body: string; endsAt?: string | null; tenantId?: string | null };
export async function getActiveSystemAlerts(): Promise<SystemAlert[]> {
  const scope = await getTenantScope();
  const snap = await getDocs(query(collection(db, "systemAlerts"), where("active", "==", true)));
  const now = Date.now();
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) } as SystemAlert)).filter((a) => (!a.tenantId || a.tenantId === scope.tenantId) && (!a.endsAt || new Date(a.endsAt).getTime() >= now));
}
