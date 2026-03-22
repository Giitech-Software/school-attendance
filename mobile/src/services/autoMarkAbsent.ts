// mobile/src/services/autoMarkAbsent.ts
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  serverTimestamp,
  doc,
  getDoc,
  setDoc,
} from "firebase/firestore";
import { db } from "../../app/firebase";
import { todayISO } from "./attendance";
import { getAttendanceSettings } from "./attendanceSettings";

/* -------------------------------------------------
   Metadata doc to prevent duplicate auto-runs
-------------------------------------------------- */
const META_REF = doc(db, "settings", "attendanceMeta");
type AutoMarkScope = "students" | "staff";

function hasReachedAutoMarkCutoff(closeAfter?: string, lateAfter?: string): boolean {
  const cutoffTime = closeAfter ?? lateAfter;
  if (!cutoffTime) return false;

  const [h, m] = cutoffTime.split(":").map(Number);
  const now = new Date();
  const cutoff = new Date();
  cutoff.setHours(h, m, 0, 0);

  return now >= cutoff;
}

/**
 * Check whether auto-mark already ran for a date
 */
async function hasAutoMarked(dateIso: string, scope: AutoMarkScope): Promise<boolean> {
  const snap = await getDoc(META_REF);
  if (!snap.exists()) return false;

  const data = snap.data();
  if (scope === "students") {
    return (
      data?.lastAutoMarkedStudentsDate === dateIso ||
      data?.lastAutoMarkedDate === dateIso
    );
  }

  return data?.lastAutoMarkedStaffDate === dateIso;
}

/**
 * Mark auto-mark as completed for a date
 */
async function setAutoMarked(
  dateIso: string,
  scope: AutoMarkScope,
  adminUid?: string
) {
  const key =
    scope === "students" ? "lastAutoMarkedStudentsDate" : "lastAutoMarkedStaffDate";
  const runByKey =
    scope === "students" ? "lastStudentsRunBy" : "lastStaffRunBy";

  await setDoc(
    META_REF,
    {
      [key]: dateIso,
      [runByKey]: adminUid ?? null,
      // Backward compatibility for old readers.
      ...(scope === "students" ? { lastAutoMarkedDate: dateIso } : {}),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

async function isStudentAutoMarkComplete(dateIso: string): Promise<boolean> {
  const [studentsSnap, attendanceSnap] = await Promise.all([
    getDocs(collection(db, "students")),
    getDocs(
      query(
        collection(db, "attendance"),
        where("date", "==", dateIso)
      )
    ),
  ]);

  if (studentsSnap.empty) return true;

  const markedStudentIds = new Set(
    attendanceSnap.docs
      .map((d) => d.data().studentId)
      .filter(Boolean)
  );

  return markedStudentIds.size >= studentsSnap.size;
}

/* -------------------------------------------------
   CORE: Auto-mark ABSENT for ALL classes
-------------------------------------------------- */
export async function autoMarkAbsentAllClasses({
  dateIso = todayISO(),
  adminUid,
  force = false, // allow manual reruns
}: {
  dateIso?: string;
  adminUid?: string;
  force?: boolean;
}) {
  const settings = await getAttendanceSettings();

  /* --------------------------------
     Cutoff check (only for TODAY)
  -------------------------------- */
  if (!force && dateIso === todayISO()) {
    if (!hasReachedAutoMarkCutoff(settings.closeAfter, settings.lateAfter)) {
      console.warn("Auto-mark skipped: cutoff not reached");
      return;
    }
  }

  /* --------------------------------
     Prevent duplicate auto-runs
  -------------------------------- */
  if (!force && (await hasAutoMarked(dateIso, "students"))) {
    const isComplete = await isStudentAutoMarkComplete(dateIso);
    if (isComplete) {
      console.warn("Student auto-mark already completed for", dateIso);
      return;
    }
    console.warn("Student meta lock found but data incomplete. Re-running for", dateIso);
  }

  const studentsSnap = await getDocs(collection(db, "students"));
  if (studentsSnap.empty) return;

  const attendanceSnap = await getDocs(
    query(
      collection(db, "attendance"),
      where("date", "==", dateIso)
    )
  );

  const presentStudentIds = new Set(
    attendanceSnap.docs
      .map((d) => d.data().studentId)
      .filter(Boolean)
  );

  const writes: Promise<any>[] = [];

  studentsSnap.forEach((studentDoc) => {
    const studentId = studentDoc.id;
    if (presentStudentIds.has(studentId)) return;

    writes.push(
      addDoc(collection(db, "attendance"), {
        studentId,
        subjectType: "student",
        subjectId: studentId,
        classId: studentDoc.data().classId ?? "",
        date: dateIso,
        type: "in",
        checkInTime: null,
        checkOutTime: null,
        biometric: false,
        status: "absent",
        autoMarked: true,
        createdAt: serverTimestamp(),
      })
    );
  });

  await Promise.all(writes);

  /* --------------------------------
     Lock date (important)
  -------------------------------- */
  await setAutoMarked(dateIso, "students", adminUid);
}
export async function autoMarkAbsentStaff({
  dateIso = todayISO(),
  adminUid,
  force = false,
}: {
  dateIso?: string;
  adminUid?: string;
  force?: boolean;
}) {
  const settings = await getAttendanceSettings();

  if (!force && dateIso === todayISO()) {
    if (!hasReachedAutoMarkCutoff(settings.closeAfter, settings.lateAfter)) {
      console.warn("Auto-mark skipped: cutoff not reached");
      return;
    }
  }

  if (!force && (await hasAutoMarked(dateIso, "staff"))) {
    console.warn("Staff auto-mark already completed for", dateIso);
    return;
  }

  const staffSnap = await getDocs(collection(db, "staff"));
  if (staffSnap.empty) return;

  const attendanceSnap = await getDocs(
    query(
      collection(db, "attendance"),
      where("subjectType", "==", "staff"),
      where("date", "==", dateIso)
    )
  );

  const presentStaffIds = new Set(
    attendanceSnap.docs.map((d) => d.data().subjectId)
  );

  const writes: Promise<any>[] = [];

  staffSnap.forEach((staffDoc) => {
    const staffId = staffDoc.id;

    if (presentStaffIds.has(staffId)) return;

    writes.push(
      addDoc(collection(db, "attendance"), {
        staffId, // legacy compatibility
        subjectType: "staff",
        subjectId: staffId,
        date: dateIso,
        type: "in",
        method: "manual",
        biometric: false,
        checkInTime: null,
        checkOutTime: null,
        status: "absent",
        autoMarked: true,
        createdAt: serverTimestamp(),
      })
    );
  });

  await Promise.all(writes);
  await setAutoMarked(dateIso, "staff", adminUid);
}

export async function autoMarkAbsentsForToday(options?: {
  dateIso?: string;
  adminUid?: string;
  force?: boolean;
}) {
  await autoMarkAbsentAllClasses(options ?? {});
  await autoMarkAbsentStaff(options ?? {});
}
