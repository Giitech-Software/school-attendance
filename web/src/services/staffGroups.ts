import { addDoc, collection, deleteDoc, doc, getDocs, query, serverTimestamp, updateDoc } from "firebase/firestore";
import { db } from "../firebase";
import { getTenantScope, requireAdminTenantScope, tenantConstraints, withTenantScope } from "./tenantScope";

export type StaffGroup = { id?: string; name: string; description?: string; createdAt?: any; tenantId?: string | null };
const groups = collection(db, "staffGroups");
export async function listStaffGroups(): Promise<StaffGroup[]> {
  const rows = (await getDocs(query(groups, ...tenantConstraints(await getTenantScope())))).docs.map(d => ({ id: d.id, ...(d.data() as any) }));
  return rows.sort((a, b) => a.name.localeCompare(b.name));
}
export async function createStaffGroup(name: string, description?: string) {
  const scope = await requireAdminTenantScope();
  const ref = await addDoc(groups, withTenantScope({ name: name.trim(), description: description?.trim() || undefined, createdAt: serverTimestamp() }, scope));
  return { id: ref.id, name: name.trim(), description } as StaffGroup;
}
export async function updateStaffGroup(group: StaffGroup) { if (!group.id) throw new Error("Group ID is required."); await updateDoc(doc(db, "staffGroups", group.id), withTenantScope({ name: group.name.trim(), description: group.description?.trim() || undefined }, await requireAdminTenantScope())); }
export async function deleteStaffGroup(id: string) { await deleteDoc(doc(db, "staffGroups", id)); }
