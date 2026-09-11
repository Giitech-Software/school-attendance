import { addDoc, collection, deleteDoc, doc, getDocs, query, serverTimestamp, updateDoc } from "firebase/firestore";
import { db } from "../../app/firebase";
import { getTenantScope, requireAdminTenantScope, tenantConstraints, withTenantScope } from "./tenantScope";
export type StaffGroup = { id?: string; name: string; description?: string; createdAt?: any; tenantId?: string | null };
const groups = collection(db, "staffGroups");
export async function listStaffGroups(): Promise<StaffGroup[]> { const rows = (await getDocs(query(groups, ...tenantConstraints(await getTenantScope())))).docs.map(d => ({ id: d.id, ...(d.data() as any) })); return rows.sort((a,b) => a.name.localeCompare(b.name)); }
export async function createStaffGroup(name: string) { const scope = await requireAdminTenantScope(); const ref = await addDoc(groups, withTenantScope({ name: name.trim(), createdAt: serverTimestamp() }, scope)); return { id: ref.id, name: name.trim() }; }
export async function deleteStaffGroup(id: string) { await deleteDoc(doc(db, "staffGroups", id)); }
export async function updateStaffGroup(group: StaffGroup) { if (!group.id) throw new Error("Group ID is required."); await updateDoc(doc(db, "staffGroups", group.id), withTenantScope({ name: group.name.trim() }, await requireAdminTenantScope())); }
