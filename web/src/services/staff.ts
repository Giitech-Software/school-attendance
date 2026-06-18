import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, limit, query, serverTimestamp, updateDoc, where } from "firebase/firestore";
import { db } from "../firebase";

export type Staff = {
  id?: string;
  staffId?: string;
  userUid?: string;
  name: string;
  email?: string;
  role?: string;
  roleType?: string;
  fingerprintId?: string;
  faceImageUrl?: string;
  faceId?: string;
  faceEnrolled?: boolean;
  createdAt?: any;
  updatedAt?: any;
};

const STAFF_COLLECTION = "staff";

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
  const snap = await getDocs(collection(db, STAFF_COLLECTION));
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) } as Staff));
}

export async function getStaffById(id: string): Promise<Staff | null> {
  const snap = await getDoc(doc(db, STAFF_COLLECTION, id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...(snap.data() as any) } as Staff;
}

export async function getStaffByStaffId(staffId: string): Promise<Staff | null> {
  const normalizedStaffId = staffId.trim().toUpperCase();
  if (!normalizedStaffId) return null;

  const staffIdQuery = query(collection(db, STAFF_COLLECTION), where("staffId", "==", normalizedStaffId), limit(1));
  const staffIdSnap = await getDocs(staffIdQuery);
  if (!staffIdSnap.empty) {
    const staffDoc = staffIdSnap.docs[0];
    return { id: staffDoc.id, ...(staffDoc.data() as any) } as Staff;
  }

  return getStaffById(staffId.trim());
}

async function ensureStaffIdIsAvailable(staffId: string): Promise<void> {
  const existingQuery = query(collection(db, STAFF_COLLECTION), where("staffId", "==", staffId), limit(1));
  const existingSnap = await getDocs(existingQuery);
  if (!existingSnap.empty) throw new Error(`Staff ID ${staffId} is already in use.`);
}

async function generateStaffId(roleType: string): Promise<string> {
  const prefix = getStaffIdPrefix(roleType);
  const snap = await getDocs(collection(db, STAFF_COLLECTION));
  const maxNumber = snap.docs.reduce((max, staffDoc) => {
    const staffId = staffDoc.data().staffId as string | undefined;
    if (!staffId?.startsWith(`${prefix}-`)) return max;
    const numberPart = Number.parseInt(staffId.split("-")[1] ?? "", 10);
    return Number.isNaN(numberPart) ? max : Math.max(max, numberPart);
  }, 0);
  return `${prefix}-${String(maxNumber + 1).padStart(4, "0")}`;
}

export async function createStaff(data: Omit<Staff, "id" | "createdAt">): Promise<Staff> {
  const roleType = data.roleType ?? data.role ?? "staff";
  const staffId = data.staffId?.trim() || (await generateStaffId(roleType));

  if (data.staffId?.trim()) {
    await ensureStaffIdIsAvailable(staffId);
  }

  const payload = withoutUndefined({ ...data, staffId, roleType, createdAt: serverTimestamp() });
  const ref = await addDoc(collection(db, STAFF_COLLECTION), payload);
  return { id: ref.id, ...payload, staffId, roleType } as Staff;
}

export async function upsertStaff(staff: Staff): Promise<void> {
  if (!staff.id) throw new Error("Staff ID is required for update.");
  const { id, ...data } = staff;
  await updateDoc(doc(db, STAFF_COLLECTION, id), withoutUndefined({ ...data, updatedAt: serverTimestamp() }));
}

export async function deleteStaff(id: string): Promise<void> {
  await deleteDoc(doc(db, STAFF_COLLECTION, id));
}
