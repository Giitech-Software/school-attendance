import { collection, getDocs, limit, orderBy, query, type Timestamp } from "firebase/firestore";
import { db } from "../firebase";

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
  createdAt?: Timestamp;
};

export async function listAdminLogs(limitCount = 150): Promise<AdminLog[]> {
  const q = query(collection(db, "adminLogs"), orderBy("createdAt", "desc"), limit(limitCount));
  const snap = await getDocs(q);
  return snap.docs.map((doc) => ({ id: doc.id, ...(doc.data() as Omit<AdminLog, "id">) }));
}
