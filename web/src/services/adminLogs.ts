import { collection, getDocs, limit, orderBy, query, type Timestamp } from "firebase/firestore";
import { db } from "../firebase";
import { getTenantScope, tenantConstraints } from "./tenantScope";

export type AdminLog = {
  id: string;
  actorUid: string;
  actorName?: string | null;
  actorRole?: string | null;
  action: string;
  targetType: string;
  targetId?: string | null;
  description: string;
  metadata?: Record<string, unknown>;
  tenantId?: string | null;
  tenantName?: string | null;
  tenantType?: string | null;
  createdAt?: Timestamp;
};

export async function listAdminLogs(limitCount = 150): Promise<AdminLog[]> {
  const scope = await getTenantScope();
  const q = scope.isScoped
    ? query(collection(db, "adminLogs"), ...tenantConstraints(scope))
    : query(collection(db, "adminLogs"), orderBy("createdAt", "desc"), limit(limitCount));
  const snap = await getDocs(q);
  const rows = snap.docs.map((doc) => ({ id: doc.id, ...(doc.data() as Omit<AdminLog, "id">) }));
  return rows.sort((a, b) => logTime(b.createdAt) - logTime(a.createdAt)).slice(0, limitCount);
}

function logTime(value: any): number {
  if (!value) return 0;
  if (typeof value?.toMillis === "function") return value.toMillis();
  if (typeof value?.toDate === "function") return value.toDate().getTime();
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}