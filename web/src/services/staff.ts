import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, limit, query, serverTimestamp, updateDoc, where } from "firebase/firestore";
import { db } from "../firebase";
import { belongsToTenant, getTenantScope, requireAdminTenantScope, sortByCreatedAtDesc, tenantConstraints, withTenantScope } from "./tenantScope";
import { deleteFace } from "./faceService";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { storage } from "../firebase";
import { getFunctions, httpsCallable } from "firebase/functions";

export type Staff = {
  id?: string;
  staffId?: string;
  userUid?: string;
  name: string;
  email?: string;
  role?: string;
  roleType?: string;
  staffGroupId?: string;
  fingerprintId?: string;
  faceImageUrl?: string;
  profilePhotoUrl?: string;
  faceId?: string;
  faceEnrolled?: boolean;
  tenantId?: string | null;
  tenantName?: string | null;
  createdAt?: any;
  updatedAt?: any;
};

const STAFF_COLLECTION = "staff";

export async function uploadStaffProfilePhoto(staffId: string, file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 320 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error("Could not compress profile photo.")), "image/jpeg", 0.72));
  const photoRef = ref(storage, `staff-profile-photos/${staffId}`);
  await uploadBytes(photoRef, blob, { contentType: "image/jpeg", cacheControl: "public,max-age=86400" });
  return getDownloadURL(photoRef);
}

export async function updateOwnStaffProfilePhoto(staffId: string, file: File): Promise<string> {
  const url = await uploadStaffProfilePhoto(staffId, file);
  await httpsCallable(getFunctions(), "updateOwnStaffProfilePhoto")({ staffId, profilePhotoUrl: url });
  return url;
}

export type StaffRoleType = "teacher" | "non_teaching_staff" | "staff" | "general_staff";

export const STAFF_ROLE_OPTIONS: { label: string; value: StaffRoleType }[] = [
  { label: "Teacher", value: "teacher" },
  { label: "Non-Teaching", value: "non_teaching_staff" },
  { label: "Staff", value: "staff" },
  { label: "General Staff", value: "general_staff" },
];

function getStaffIdPrefix(roleType?: string): string {
  return roleType === "teacher" ? "TCH" : "NST";
}

function withoutUndefined<T extends Record<string, any>>(data: T): T {
  const clean = { ...data };
  Object.keys(clean).forEach((key) => {
    if (clean[key] === undefined) delete clean[key];
  });
  return clean;
}

export async function listStaff(): Promise<Staff[]> {
  const scope = await getTenantScope();
  const snap = await getDocs(query(collection(db, STAFF_COLLECTION), ...tenantConstraints(scope)));
  return sortByCreatedAtDesc(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) } as Staff)));
}

export async function listLegacyStaff(): Promise<Staff[]> {
  const scope = await getTenantScope();
  if (!scope.isSuperAdmin) throw new Error("Super Admin permission is required.");
  const snap = await getDocs(collection(db, STAFF_COLLECTION));
  return sortByCreatedAtDesc(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) } as Staff)).filter((staff) => !staff.tenantId));
}

export async function migrateLegacyStaffToTenant(staffId: string, tenant: { id: string; name: string; type: string }): Promise<void> {
  const scope = await getTenantScope();
  if (!scope.isSuperAdmin) throw new Error("Super Admin permission is required.");
  const ref = doc(db, STAFF_COLLECTION, staffId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("Staff record not found.");
  const data = snap.data() as Staff;
  if (data.tenantId) throw new Error("This staff member is already assigned to a tenant.");
  await updateDoc(ref, { tenantId: tenant.id, tenantName: tenant.name, tenantType: tenant.type, updatedAt: serverTimestamp() });
}

export async function getStaffById(id: string): Promise<Staff | null> {
  const snap = await getDoc(doc(db, STAFF_COLLECTION, id));
  if (!snap.exists()) return null;
  const data = snap.data();
  if (!belongsToTenant(data, await getTenantScope())) return null;
  const staff = { id: snap.id, ...(data as any) } as Staff;
  try { staff.profilePhotoUrl = await getDownloadURL(ref(storage, `staff-profile-photos/${snap.id}`)); } catch { staff.profilePhotoUrl = undefined; }
  return staff;
}

export async function getStaffByStaffId(staffId: string): Promise<Staff | null> {
  const normalizedStaffId = staffId.trim().toUpperCase();
  if (!normalizedStaffId) return null;

  const scope = await getTenantScope();
  const staffIdQuery = query(collection(db, STAFF_COLLECTION), where("staffId", "==", normalizedStaffId), ...tenantConstraints(scope), limit(1));
  const staffIdSnap = await getDocs(staffIdQuery);
  if (!staffIdSnap.empty) {
    const staffDoc = staffIdSnap.docs[0];
    return { id: staffDoc.id, ...(staffDoc.data() as any) } as Staff;
  }

  return getStaffById(staffId.trim());
}

async function ensureStaffIdIsAvailable(staffId: string): Promise<void> {
  const scope = await getTenantScope();
  const existingQuery = query(collection(db, STAFF_COLLECTION), where("staffId", "==", staffId), ...tenantConstraints(scope), limit(1));
  const existingSnap = await getDocs(existingQuery);
  if (!existingSnap.empty) throw new Error(`Staff ID ${staffId} is already in use.`);
}

async function generateStaffId(roleType: string): Promise<string> {
  const scope = await getTenantScope();
  const prefix = getStaffIdPrefix(roleType);
  const snap = await getDocs(query(collection(db, STAFF_COLLECTION), ...tenantConstraints(scope)));
  const maxNumber = snap.docs.reduce((max, staffDoc) => {
    const staffId = staffDoc.data().staffId as string | undefined;
    if (!staffId?.startsWith(`${prefix}-`)) return max;
    const numberPart = Number.parseInt(staffId.split("-")[1] ?? "", 10);
    return Number.isNaN(numberPart) ? max : Math.max(max, numberPart);
  }, 0);
  return `${prefix}-${String(maxNumber + 1).padStart(4, "0")}`;
}

export async function createStaff(data: Omit<Staff, "id" | "createdAt">): Promise<Staff> {
  const scope = await requireAdminTenantScope();
  const roleType = data.roleType ?? data.role ?? "staff";
  const staffId = data.staffId?.trim() || (await generateStaffId(roleType));

  if (data.staffId?.trim()) await ensureStaffIdIsAvailable(staffId);

  const payload = withoutUndefined(withTenantScope({ ...data, staffId, roleType, createdAt: serverTimestamp() }, scope));
  const ref = await addDoc(collection(db, STAFF_COLLECTION), payload);
  return { id: ref.id, ...payload, staffId, roleType } as Staff;
}

export async function upsertStaff(staff: Staff): Promise<void> {
  if (!staff.id) throw new Error("Staff ID is required for update.");
  const { id, ...data } = staff;
  await updateDoc(doc(db, STAFF_COLLECTION, id), withoutUndefined(withTenantScope({ ...data, updatedAt: serverTimestamp() }, await getTenantScope())));
}

export async function deleteStaff(id: string): Promise<void> {
  const staffSnap = await getDoc(doc(db, STAFF_COLLECTION, id));
  const faceId = staffSnap.exists() ? (staffSnap.data() as Staff).faceId : undefined;
  if (faceId) await deleteFace(faceId);
  await deleteDoc(doc(db, STAFF_COLLECTION, id));
}
