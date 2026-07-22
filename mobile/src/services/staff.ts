// mobile/src/services/staff.ts
import {
  addDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  getDocs,
  doc,
  collection,
  serverTimestamp,
  query,
  where,
  limit,
  setDoc,
} from "firebase/firestore";

import { db } from "../../app/firebase";
import type { Staff } from "./types";
import { logAdminAction } from "./adminLogs";
import { belongsToTenant, getTenantScope, sortByCreatedAtDesc, tenantConstraints, withTenantScope } from "./tenantScope";

/* ============================
   COLLECTION
============================ */
const STAFF_COLLECTION = "staff";

export type StaffRoleType =
  | "teacher"
  | "non_teaching_staff"
  | "staff"
  | "general_staff";

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
    if (clean[key] === undefined) {
      delete clean[key];
    }
  });
  return clean;
}

async function ensureStaffIdIsAvailable(staffId: string): Promise<void> {
  const existingQuery = query(
    collection(db, STAFF_COLLECTION),
    where("staffId", "==", staffId),
    ...tenantConstraints(await getTenantScope()),
    limit(1)
  );
  const existingSnap = await getDocs(existingQuery);

  if (!existingSnap.empty) {
    throw new Error(`Staff ID ${staffId} is already in use.`);
  }
}

async function generateStaffId(roleType: string): Promise<string> {
  const prefix = getStaffIdPrefix(roleType);

  const snap = await getDocs(query(collection(db, STAFF_COLLECTION), ...tenantConstraints(await getTenantScope())));
  const maxNumber = snap.docs.reduce((max, staffDoc) => {
    const staffId = staffDoc.data().staffId as string | undefined;
    if (!staffId?.startsWith(`${prefix}-`)) return max;

    const numberPart = Number.parseInt(staffId.split("-")[1] ?? "", 10);
    return Number.isNaN(numberPart) ? max : Math.max(max, numberPart);
  }, 0);

  return `${prefix}-${String(maxNumber + 1).padStart(4, "0")}`;
}

export async function createStaffFromUser(
  userUid: string,
  name: string,
  email: string,
  roleType: string,
  requestedStaffId?: string
) {
  const normalizedEmail = email.trim().toLowerCase();
  // ✅ 1. CHECK IF STAFF ALREADY EXISTS FOR THIS USER
  const existingQuery = query(
    collection(db, STAFF_COLLECTION),
    where("userUid", "==", userUid),
    ...tenantConstraints(await getTenantScope()),
    limit(1)
  );

  const existingSnap = await getDocs(existingQuery);

  if (!existingSnap.empty) {
    console.log("Staff already exists for this user. Skipping creation.");
    return existingSnap.docs[0].data().staffId;
  }

  // ✅ 2. GENERATE NEW STAFF ID
  if (normalizedEmail) {
    const existingEmailQuery = query(
      collection(db, STAFF_COLLECTION),
      where("email", "==", normalizedEmail),
      ...tenantConstraints(await getTenantScope()),
      limit(1)
    );

    const existingEmailSnap = await getDocs(existingEmailQuery);

    if (!existingEmailSnap.empty) {
      const staffDoc = existingEmailSnap.docs[0];
      const staffData = staffDoc.data();
      const staffId =
        staffData.staffId ??
        requestedStaffId?.trim() ??
        await generateStaffId(roleType);

      if (!staffData.staffId && requestedStaffId?.trim()) {
        await ensureStaffIdIsAvailable(requestedStaffId.trim());
      }

      await updateDoc(doc(db, STAFF_COLLECTION, staffDoc.id), withoutUndefined(withTenantScope({
        staffId,
        userUid,
        name,
        email: normalizedEmail,
        role: roleType,
        roleType,
        updatedAt: serverTimestamp(),
      }, await getTenantScope())));
      await logAdminAction({
        action: "LINK_STAFF_USER",
        targetType: "staff",
        targetId: staffDoc.id,
        description: `Linked staff profile ${name} to a user account`,
        metadata: {
          staffId,
          userUid,
          email: normalizedEmail,
          roleType,
        },
      });

      return staffId;
    }
  }

  const staffId = requestedStaffId?.trim() || await generateStaffId(roleType);
  if (requestedStaffId?.trim()) {
    await ensureStaffIdIsAvailable(requestedStaffId.trim());
  }

  // ✅ 3. CREATE NEW STAFF DOC
  const ref = doc(collection(db, STAFF_COLLECTION));

  await setDoc(ref, withoutUndefined(withTenantScope({
    staffId,
    userUid,
    name,
    email: normalizedEmail,
    role: roleType,
    roleType,
    createdAt: serverTimestamp(),
  }, await getTenantScope())));
  await logAdminAction({
    action: "CREATE_STAFF",
    targetType: "staff",
    targetId: ref.id,
    description: `Created staff profile ${name}`,
    metadata: {
      staffId,
      userUid,
      email: normalizedEmail,
      roleType,
    },
  });

  return staffId;
}


/* ============================
   LIST STAFF
============================ */
export async function listStaff(): Promise<Staff[]> {
  const snap = await getDocs(query(collection(db, STAFF_COLLECTION), ...tenantConstraints(await getTenantScope())));
  return snap.docs.map(
    (d) =>
      ({
        id: d.id,
        ...d.data(),
      } as Staff)
  );
}

/* ============================
   GET STAFF BY ID
============================ */
export async function getStaffById(id: string): Promise<Staff | null> {
  const ref = doc(db, STAFF_COLLECTION, id);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  const data = snap.data();
  if (!belongsToTenant(data, await getTenantScope())) return null;
  return { id: snap.id, ...data } as Staff;
}

export async function getStaffByStaffId(staffId: string): Promise<Staff | null> {
  const normalizedStaffId = staffId.trim().toUpperCase();
  if (!normalizedStaffId) return null;

  const staffIdQuery = query(
    collection(db, STAFF_COLLECTION),
    where("staffId", "==", normalizedStaffId),
    ...tenantConstraints(await getTenantScope()),
    limit(1)
  );

  const staffIdSnap = await getDocs(staffIdQuery);
  if (!staffIdSnap.empty) {
    const staffDoc = staffIdSnap.docs[0];
    return {
      id: staffDoc.id,
      ...staffDoc.data(),
    } as Staff;
  }

  return await getStaffById(staffId.trim());
}

export async function getStaffByUserUid(userUid: string): Promise<Staff | null> {
  const q = query(
    collection(db, STAFF_COLLECTION),
    where("userUid", "==", userUid),
    ...tenantConstraints(await getTenantScope()),
    limit(1)
  );

  const snap = await getDocs(q);
  if (snap.empty) return null;

  const staffDoc = snap.docs[0];
  return {
    id: staffDoc.id,
    ...staffDoc.data(),
  } as Staff;
}

/* ============================
   CREATE STAFF
============================ */
export async function createStaff(
  data: Omit<Staff, "id" | "createdAt">
): Promise<Staff> {
  const roleType = data.roleType ?? data.role ?? "staff";
  const staffId = data.staffId?.trim() || await generateStaffId(roleType);

  if (data.staffId?.trim()) {
    await ensureStaffIdIsAvailable(staffId);
  }

  const payload = withoutUndefined(withTenantScope({
    ...data,
    staffId,
    roleType,
    createdAt: serverTimestamp(),
  }, await getTenantScope()));

  const ref = await addDoc(collection(db, STAFF_COLLECTION), payload);
  await logAdminAction({
    action: "CREATE_STAFF",
    targetType: "staff",
    targetId: ref.id,
    description: `Created staff profile ${data.name}`,
    metadata: {
      staffId,
      userUid: data.userUid,
      email: data.email,
      roleType,
    },
  });

  return {
    id: ref.id,
    ...payload,
    staffId,
    roleType,
  };
}

/* ============================
   UPDATE / UPSERT STAFF
============================ */
export async function upsertStaff(staff: Staff): Promise<void> {
  if (!staff.id) {
    throw new Error("Staff ID is required for update");
  }

  const { id, ...data } = staff;
  const ref = doc(db, STAFF_COLLECTION, id);

  await updateDoc(ref, withoutUndefined(withTenantScope({
    ...data,
    updatedAt: serverTimestamp(),
  }, await getTenantScope())));
  await logAdminAction({
    action: "EDIT_STAFF",
    targetType: "staff",
    targetId: id,
    description: `Updated staff profile ${staff.name ?? id}`,
    metadata: {
      staffId: staff.staffId,
      userUid: staff.userUid,
      email: staff.email,
      role: staff.role,
      roleType: staff.roleType,
    },
  });
}

/* ============================
   DELETE STAFF
============================ */
export async function deleteStaff(id: string): Promise<void> {
  await deleteDoc(doc(db, STAFF_COLLECTION, id));
  await logAdminAction({
    action: "DELETE_STAFF",
    targetType: "staff",
    targetId: id,
    description: "Deleted staff profile",
  });
}


