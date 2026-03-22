import {
  collection,
  getDocs,
  orderBy,
  limit,
  query,
  Timestamp,
} from "firebase/firestore";
import { db } from "@/app/firebase";

/* ---------------------------
   TYPES
--------------------------- */
export type AdminLog = {
  id: string;
  actorUid: string;
  actorName?: string | null;
  actorRole: string;
  action: string;
  targetType: string;
  targetId?: string | null;
  description: string;
  metadata?: Record<string, any>;
  createdAt?: Timestamp;
};

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
