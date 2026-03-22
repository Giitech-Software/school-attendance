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
   orderBy,
  limit,
 
  setDoc,
} from "firebase/firestore";


import { db } from "../../app/firebase";
import type { Staff } from "./types";

/* ============================
   COLLECTION
============================ */
const STAFF_COLLECTION = "staff";

async function generateStaffId(roleType: string): Promise<string> {
  const prefix =
    roleType === "teacher" ? "TCH" : "NST";

  const q = query(
    collection(db, STAFF_COLLECTION),
    orderBy("createdAt", "desc"),
    limit(1)
  );

  const snap = await getDocs(q);

  let nextNumber = 1;

  if (!snap.empty) {
    const last = snap.docs[0].data();
    const lastId = last.staffId as string;

    const numberPart = parseInt(lastId.split("-")[1]);
    if (!isNaN(numberPart)) {
      nextNumber = numberPart + 1;
    }
  }

  return `${prefix}-${String(nextNumber).padStart(4, "0")}`;
}

export async function createStaffFromUser(
  userUid: string,
  name: string,
  email: string,
  roleType: string
) {
  // ✅ 1. CHECK IF STAFF ALREADY EXISTS FOR THIS USER
  const existingQuery = query(
    collection(db, STAFF_COLLECTION),
    where("userUid", "==", userUid),
    limit(1)
  );

  const existingSnap = await getDocs(existingQuery);

  if (!existingSnap.empty) {
    console.log("Staff already exists for this user. Skipping creation.");
    return existingSnap.docs[0].data().staffId;
  }

  // ✅ 2. GENERATE NEW STAFF ID
  const staffId = await generateStaffId(roleType);

  // ✅ 3. CREATE NEW STAFF DOC
  const ref = doc(collection(db, STAFF_COLLECTION));

  await setDoc(ref, {
    staffId,
    userUid,
    name,
    email,
    roleType,
    createdAt: serverTimestamp(),
  });

  return staffId;
}


/* ============================
   LIST STAFF
============================ */
export async function listStaff(): Promise<Staff[]> {
  const snap = await getDocs(collection(db, STAFF_COLLECTION));
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

  return {
    id: snap.id,
    ...snap.data(),
  } as Staff;
}

/* ============================
   CREATE STAFF
============================ */
export async function createStaff(
  data: Omit<Staff, "id" | "createdAt">
): Promise<Staff> {
  const ref = await addDoc(collection(db, STAFF_COLLECTION), {
    ...data,
    createdAt: serverTimestamp(),
  });

  return {
    id: ref.id,
    ...data,
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

  await updateDoc(ref, {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

/* ============================
   DELETE STAFF
============================ */
export async function deleteStaff(id: string): Promise<void> {
  await deleteDoc(doc(db, STAFF_COLLECTION, id));
}
