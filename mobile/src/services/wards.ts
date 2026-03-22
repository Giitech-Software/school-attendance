import {
  collection,
  getDocs,
  query,
  where,
  serverTimestamp,
  deleteDoc,
  doc,
  setDoc,
} from "firebase/firestore";
import { db } from "@/app/firebase";

export type Ward = {
  id: string;
  parentUid: string;
  studentId: string;
  createdAt?: any;
};

/* ---------------------------
   READ wards for a parent
--------------------------- */
export async function getWardsForParent(parentUid: string): Promise<Ward[]> {
  const q = query(
    collection(db, "wards"),
    where("parentUid", "==", parentUid)
  );

  const snap = await getDocs(q);

  return snap.docs.map(d => ({
    id: d.id,
    ...(d.data() as Omit<Ward, "id">),
  }));
}

/* ---------------------------
   ASSIGN ward (admin only)
   deterministic ID = no duplicates
--------------------------- */
export async function assignWard(
  parentUid: string,
  studentId: string
) {
  const wardId = `${parentUid}_${studentId}`;
  const ref = doc(db, "wards", wardId);

  await setDoc(ref, {
    parentUid,
    studentId,
    createdAt: serverTimestamp(),
  });

  return ref;
}

/* ---------------------------
   REMOVE ward (admin only)
--------------------------- */
export async function removeWard(wardId: string) {
  await deleteDoc(doc(db, "wards", wardId));
}
