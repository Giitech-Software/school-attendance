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

/* ---------------------------
   TYPES
--------------------------- */
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

  return Object.fromEntries(
    Object.entries(metadata).filter(([, value]) => value !== undefined)
  );
}

/* ---------------------------
   WRITE admin logs
--------------------------- */
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
    await addDoc(collection(db, "adminLogs"), {
      actorUid: currentUser.uid,
      actorName:
        actorName ?? currentUser.displayName ?? currentUser.email ?? null,
      actorRole: actorRole ?? null,
      action,
      targetType,
      targetId: targetId ?? null,
      description,
      metadata: cleanMetadata(metadata),
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    console.warn("Failed to log admin action:", err);
  }
}

/* ---------------------------
   READ admin logs
--------------------------- */
export async function listAdminLogs(limitCount = 100): Promise<AdminLog[]> {
  const q = query(
    collection(db, "adminLogs"),
    orderBy("createdAt", "desc"),
    limit(limitCount)
  );

  const snap = await getDocs(q);

  return snap.docs.map((d) => ({
    id: d.id,
    ...(d.data() as Omit<AdminLog, "id">),
  }));
}
