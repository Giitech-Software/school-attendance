import {
  collection,
  query,
  where,
  getDocs,
  serverTimestamp,
  doc,
  getDoc,
  setDoc,
  type QueryDocumentSnapshot,
  type DocumentData,
} from "firebase/firestore";
import { db } from "../../app/firebase";
import { todayISO } from "./attendance";
import {
  getAttendanceSettings,
  hasReachedAttendanceCloseTime,
  isWeekendForAttendance,
} from "./attendanceSettings";
import {
  getTenantScope,
  tenantConstraints,
  withTenantScope,
  type TenantScope,
} from "./tenantScope";

const ATTENDANCE_COLLECTION = collection(db, "attendance");
const DEFAULT_CATCH_UP_DAYS = 7;
type AutoMarkScope = "students" | "staff";

type AutoMarkResult = {
  created: number;
  skipped: boolean;
  complete: boolean;
};

type AutoMarkRunResult = {
  dateIso: string;
  students: AutoMarkResult;
  staff: AutoMarkResult;
};

function activeDocs(snapshot: { docs: QueryDocumentSnapshot<DocumentData>[] }) {
  return snapshot.docs.filter((item) => item.data().isActive !== false);
}

function dateInTimezone(date: Date, timezone: string) {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(date);
    const year = parts.find((part) => part.type === "year")?.value;
    const month = parts.find((part) => part.type === "month")?.value;
    const day = parts.find((part) => part.type === "day")?.value;

    if (year && month && day) return `${year}-${month}-${day}`;
  } catch {
    // Fall back to the existing helper if the saved timezone is unsupported.
  }

  return todayISO();
}

function addDays(dateIso: string, days: number) {
  const [year, month, day] = dateIso.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return date.toISOString().slice(0, 10);
}

function autoMarkDatesThrough(latestDateIso: string, days: number) {
  const count = Math.max(1, Math.min(days, 31));
  return Array.from({ length: count }, (_, index) => addDays(latestDateIso, index - count + 1));
}


function metaRef(tenantScope: TenantScope) {
  const suffix = tenantScope.isScoped && tenantScope.tenantId ? `__${tenantScope.tenantId}` : "";
  return doc(db, "settings", `attendanceMeta${suffix}`);
}

function allowsStudentScope(tenantScope: TenantScope) {
  return !tenantScope.isScoped || tenantScope.tenantType === "school";
}

async function hasAutoMarked(dateIso: string, scope: AutoMarkScope, tenantScope: TenantScope) {
  const snap = await getDoc(metaRef(tenantScope));
  if (!snap.exists()) return false;
  const data = snap.data();
  return scope === "students"
    ? data.lastAutoMarkedStudentsDate === dateIso || data.lastAutoMarkedDate === dateIso
    : data.lastAutoMarkedStaffDate === dateIso;
}

async function setAutoMarked(dateIso: string, scope: AutoMarkScope, tenantScope: TenantScope, adminUid?: string) {
  const key = scope === "students" ? "lastAutoMarkedStudentsDate" : "lastAutoMarkedStaffDate";
  const runByKey = scope === "students" ? "lastStudentsRunBy" : "lastStaffRunBy";

  await setDoc(
    metaRef(tenantScope),
    withTenantScope({
      [key]: dateIso,
      [runByKey]: adminUid ?? null,
      ...(scope === "students" ? { lastAutoMarkedDate: dateIso } : {}),
      updatedAt: serverTimestamp(),
    }, tenantScope),
    { merge: true }
  );
}

function markedIdsForScope(
  attendanceDocs: QueryDocumentSnapshot<DocumentData>[],
  scope: AutoMarkScope
) {
  return new Set(
    attendanceDocs
      .map((item) => {
        const data = item.data();
        if (scope === "students") {
          return data.subjectType === "staff" ? null : data.studentId ?? data.subjectId;
        }
        return data.subjectType === "staff" ? data.subjectId ?? data.staffId : null;
      })
      .filter((value): value is string => Boolean(value))
  );
}

async function loadScopeState(dateIso: string, scope: AutoMarkScope, tenantScope: TenantScope) {
  const [peopleSnap, attendanceSnap] = await Promise.all([
    getDocs(query(collection(db, scope === "students" ? "students" : "staff"), ...tenantConstraints(tenantScope))),
    getDocs(query(ATTENDANCE_COLLECTION, where("date", "==", dateIso), ...tenantConstraints(tenantScope))),
  ]);

  const people = activeDocs(peopleSnap);
  const markedIds = markedIdsForScope(attendanceSnap.docs, scope);
  const complete = people.every((person) => markedIds.has(person.id));
  return { people, markedIds, complete };
}

async function autoMarkScope({
  scope,
  dateIso,
  adminUid,
  force,
  tenantScope,
}: {
  scope: AutoMarkScope;
  dateIso: string;
  adminUid?: string;
  force: boolean;
  tenantScope: TenantScope;
}): Promise<AutoMarkResult> {
  if (scope === "students" && !allowsStudentScope(tenantScope)) {
    return { created: 0, skipped: true, complete: true };
  }
  const settings = await getAttendanceSettings();
  const isWeekend = isWeekendForAttendance(settings, new Date(`${dateIso}T12:00:00`));

  if (scope === "students" && isWeekend) {
    await setAutoMarked(dateIso, scope, tenantScope, adminUid);
    return { created: 0, skipped: true, complete: true };
  }
  if (scope === "staff" && isWeekend && !settings.allowStaffWeekendAttendance) {
    await setAutoMarked(dateIso, scope, tenantScope, adminUid);
    return { created: 0, skipped: true, complete: true };
  }

  const localTodayIso = dateInTimezone(new Date(), settings.timezone);
  if (!force && dateIso > localTodayIso) {
    return { created: 0, skipped: true, complete: false };
  }
  if (!force && dateIso === localTodayIso && !hasReachedAttendanceCloseTime(settings)) {
    return { created: 0, skipped: true, complete: false };
  }

  const state = await loadScopeState(dateIso, scope, tenantScope);
  if (state.complete) {
    if (!(await hasAutoMarked(dateIso, scope, tenantScope))) {
      await setAutoMarked(dateIso, scope, tenantScope, adminUid);
    }
    return { created: 0, skipped: true, complete: true };
  }

  if (!force && (await hasAutoMarked(dateIso, scope, tenantScope))) {
    console.warn(`${scope} auto-mark lock was incomplete; repairing ${dateIso}`);
  }

  const missingPeople = state.people.filter((person) => !state.markedIds.has(person.id));
  await Promise.all(
    missingPeople.map((person) => {
      const data = person.data();
      const attendanceId = `auto-${scope}-${dateIso}-${person.id}`;
      const common = withTenantScope({
        subjectType: scope === "students" ? "student" : "staff",
        subjectId: person.id,
        date: dateIso,
        type: "in",
        method: "manual",
        checkInTime: null,
        checkOutTime: null,
        biometric: false,
        status: "absent",
        autoMarked: true,
        createdAt: serverTimestamp(),
      }, tenantScope);

      return setDoc(
        doc(ATTENDANCE_COLLECTION, attendanceId),
        scope === "students"
          ? {
              ...common,
              studentId: person.id,
              classId: data.classId ?? "",
              classDocId: data.classDocId ?? null,
            }
          : { ...common, staffId: person.id },
        { merge: true }
      );
    })
  );

  await setAutoMarked(dateIso, scope, tenantScope, adminUid);
  return { created: missingPeople.length, skipped: false, complete: true };
}

export async function autoMarkAbsentAllClasses({
  dateIso = todayISO(),
  adminUid,
  force = false,
}: {
  dateIso?: string;
  adminUid?: string;
  force?: boolean;
} = {}) {
  return autoMarkScope({ scope: "students", dateIso, adminUid, force, tenantScope: await getTenantScope() });
}

export async function autoMarkAbsentStaff({
  dateIso = todayISO(),
  adminUid,
  force = false,
}: {
  dateIso?: string;
  adminUid?: string;
  force?: boolean;
} = {}) {
  return autoMarkScope({ scope: "staff", dateIso, adminUid, force, tenantScope: await getTenantScope() });
}

export async function autoMarkAbsentsForToday(options: {
  dateIso?: string;
  adminUid?: string;
  force?: boolean;
  catchUpDays?: number;
} = {}) {
  const tenantScope = await getTenantScope();
  if (tenantScope.isSuperAdmin && !tenantScope.isScoped) {
    const skipped = { created: 0, skipped: true, complete: true };
    return { dateIso: options.dateIso ?? todayISO(), students: skipped, staff: skipped, runs: [] };
  }
  const settings = await getAttendanceSettings();
  const localTodayIso = dateInTimezone(new Date(), settings.timezone);
  const dateIso =
    options.dateIso ??
    (hasReachedAttendanceCloseTime(settings) ? localTodayIso : addDays(localTodayIso, -1));
  const force = options.force ?? false;
  const dates = options.dateIso
    ? [dateIso]
    : autoMarkDatesThrough(dateIso, options.catchUpDays ?? DEFAULT_CATCH_UP_DAYS);
  const runs: AutoMarkRunResult[] = [];

  for (const runDateIso of dates) {
    const [students, staff] = await Promise.all([
      autoMarkScope({ scope: "students", dateIso: runDateIso, adminUid: options.adminUid, force, tenantScope }),
      autoMarkScope({ scope: "staff", dateIso: runDateIso, adminUid: options.adminUid, force, tenantScope }),
    ]);
    runs.push({ dateIso: runDateIso, students, staff });
  }

  const latest = runs[runs.length - 1] ?? {
    dateIso,
    students: { created: 0, skipped: true, complete: false },
    staff: { created: 0, skipped: true, complete: false },
  };

  return { ...latest, runs };
}




