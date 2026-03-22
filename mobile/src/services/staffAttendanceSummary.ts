//mobile/src/services/staffAttendanceSummary.ts
import { query, where, getDocs, collection, doc, getDoc, orderBy } from "firebase/firestore";
import { db } from "../../app/firebase";
import type { AttendanceRecord } from "./types";

const attendanceCollection = collection(db, "attendance");
const staffCollection = collection(db, "staff");

export type StaffAttendanceSummary = {
  staffId: string;

  staffName: string;
  displayId?: string;   // 👈 human readable ID

  presentCount: number;
  lateCount: number;
  absentCount: number;

  attendedSessions: number;
  totalDays: number;
  percentagePresent: number;
};


/** Get Staff attendance in a date range */
export async function getStaffAttendanceInRange(
  staffId: string,
  fromIso: string,
  toIso: string
): Promise<AttendanceRecord[]> {
  const q = query(
    attendanceCollection,
    where("subjectType", "==", "staff"),
    where("subjectId", "==", staffId),
    where("date", ">=", fromIso),
    where("date", "<=", toIso)
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as AttendanceRecord));
}

/** Compute Summary for all Staff */
export async function getStaffGlobalSummary(fromIso: string, toIso: string) {
  const staffSnap = await getDocs(staffCollection);
  const allStaff = staffSnap.docs.map(d => ({ id: d.id, ...d.data() }));

  const summaries = await Promise.all(allStaff.map(async (s: any) => {
    const records = await getStaffAttendanceInRange(s.id, fromIso, toIso);
    
    let present = 0, late = 0, absent = 0;

    records.forEach(r => {
      if (r.status === "late") late++;
      else if (r.status === "absent") absent++;
      else present++;
    });

    const attendedSessions = present + late;
    const totalDays = attendedSessions + absent;

    const score = present + late * 0.5;

    const percentage =
      totalDays === 0
        ? 0
        : Number(((score / totalDays) * 100).toFixed(2));

    return {
  staffId: s.id,

  staffName: s.name || "Unknown Staff",
  displayId: s.staffId || s.id,   // 👈 IMPORTANT

  presentCount: present,
  lateCount: late,
  absentCount: absent,

  attendedSessions,
  totalDays,
  percentagePresent: percentage,
};
  }));

  return summaries;
}

/** Get all staff attendance in a date range */
export async function getAllStaffAttendanceInRange(
  fromIso: string,
  toIso: string
): Promise<AttendanceRecord[]> {
  const q = query(
    attendanceCollection,
    where("subjectType", "==", "staff"),
    where("date", ">=", fromIso),
    where("date", "<=", toIso)
  );

  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as AttendanceRecord));
}


export async function getStaffDailyLogs(dateIso: string) {
  // 1. Get all staff members
  const staffSnap = await getDocs(collection(db, "staff"));
  const staffList = staffSnap.docs.map(d => ({
    id: d.id,
    name: d.data().name || "Unknown",
    staffId: d.data().staffId || d.id
  }));

  // 2. Get all staff attendance for that specific date
  const q = query(
    collection(db, "attendance"),
    where("subjectType", "==", "staff"),
    where("date", "==", dateIso)
  );
  
  const attendanceSnap = await getDocs(q);
  const attendanceMap = new Map();
  
  attendanceSnap.docs.forEach(d => {
    attendanceMap.set(d.data().subjectId, d.data());
  });

  // 3. Merge: Every staff member gets a row, even if they didn't scan
  return staffList.map(staff => {
    const record = attendanceMap.get(staff.id);
    return {
      ...staff,
      checkIn: record?.checkInTime ? new Date(record.checkInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "—",
      checkOut: record?.checkOutTime ? new Date(record.checkOutTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "—",
      status: record?.status || "absent",
    };
  });
}