import {
  collection,
  addDoc,
  getDocs,
  orderBy,
  limit,
  query,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { auth, db } from "@/app/firebase";
import { getTenantScope, tenantConstraints, withTenantScope } from "./tenantScope";

export type AdminLog = {
  id: string;
  actorUid: string;
  actorName?: string | null;
  actorRole?: string | null;
  action: string;
  targetType: string;
  targetId?: string | null;
  description: string;
  metadata?: Record<string, any>;
  tenantId?: string | null;
  tenantName?: string | null;
  tenantType?: string | null;
  createdAt?: Timestamp;
};

export type AdminLogInput = {
  action: string;
  targetType: string;
  targetId?: string | null;
  description: string;
  actorRole?: string | null;
  actorName?: string | null;
  metadata?: Record<string, any>;
};

function cleanMetadata(metadata?: Record<string, any>) {
  if (!metadata) return {};
  return Object.fromEntries(Object.entries(metadata).filter(([, value]) => value !== undefined));
}

export async function logAdminAction({
  action,
  targetType,
  targetId,
  description,
  actorRole,
  actorName,
  metadata,
}: AdminLogInput): Promise<void> {
  const currentUser = auth.currentUser;
  if (!currentUser) return;

  try {
    const scope = await getTenantScope();
    await addDoc(collection(db, "adminLogs"), withTenantScope({
      actorUid: currentUser.uid,
      actorName: actorName ?? currentUser.displayName ?? currentUser.email ?? null,
      actorRole: actorRole ?? null,
      action,
      targetType,
      targetId: targetId ?? null,
      description,
      metadata: cleanMetadata(metadata),
      createdAt: serverTimestamp(),
    }, scope));
  } catch (err) {
    console.warn("Failed to log admin action:", err);
  }
}

export async function listAdminLogs(limitCount = 100): Promise<AdminLog[]> {
  const scope = await getTenantScope();
  const q = scope.isScoped
    ? query(collection(db, "adminLogs"), ...tenantConstraints(scope))
    : query(collection(db, "adminLogs"), orderBy("createdAt", "desc"), limit(limitCount));
  const snap = await getDocs(q);
  const rows = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<AdminLog, "id">) }));
  return rows.sort((a, b) => logTime(b.createdAt) - logTime(a.createdAt)).slice(0, limitCount);
}

function logTime(value: any): number {
  if (!value) return 0;
  if (typeof value?.toMillis === "function") return value.toMillis();
  if (typeof value?.toDate === "function") return value.toDate().getTime();
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}