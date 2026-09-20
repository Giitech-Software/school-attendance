import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "./firebase";
import { tenantConstraints, getTenantScope } from "./tenantScope";

export type Holiday = { id: string; date: string; name: string };

export async function getHolidaysInRange(fromIso: string, toIso: string): Promise<Holiday[]> {
  const snap = await getDocs(query(
    collection(db, "holidays"),
    where("date", ">=", fromIso),
    where("date", "<=", toIso),
    ...tenantConstraints(await getTenantScope()),
  ));
  return snap.docs.map((item) => ({ id: item.id, date: String(item.data().date ?? "").slice(0, 10), name: String(item.data().name ?? "Holiday") }));
}
