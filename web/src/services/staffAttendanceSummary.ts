import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../firebase";
import type { AttendanceRecord } from "../types";

const attendanceCollection = collection(db, "attendance");
const staffCollection = collection(db, "staff");

export type StaffAttendanceSummary = {
  staffId: string;
  staffName: string;
  displayId?: string;
  presentCount: number;
  lateCount: number;
  absentCount: number;
  attendedSessions: number;
  totalDays: number;
  totalSessions?: number;
  percentagePresent: number;
};

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
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) } as AttendanceRecord));
}

export async function getStaffGlobalSummary(fromIso: string, toIso: string): Promise<StaffAttendanceSummary[]> {
  const staffSnap = await getDocs(staffCollection);
  const allStaff = staffSnap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));

  const summaries = await Promise.all(
    allStaff.map(async (staff: any) => {
      const records = await getStaffAttendanceInRange(staff.id, fromIso, toIso);
      let present = 0;
      let late = 0;
      let absent = 0;

      records.forEach((record) => {
        if (record.status === "late") late++;
        else if (record.status === "absent") absent++;
        else present++;
      });

      const attendedSessions = present + late;
      const totalDays = attendedSessions + absent;
      const score = present + late * 0.5;
      const percentagePresent = totalDays === 0 ? 0 : Number(((score / totalDays) * 100).toFixed(2));

      return {
        staffId: staff.id,
        staffName: staff.name || "Unknown Staff",
        displayId: staff.staffId || staff.id,
        presentCount: present,
        lateCount: late,
        absentCount: absent,
        attendedSessions,
        totalDays,
        totalSessions: totalDays,
        percentagePresent,
      };
    })
  );

  return summaries;
}

export async function getAllStaffAttendanceInRange(fromIso: string, toIso: string): Promise<AttendanceRecord[]> {
  const q = query(attendanceCollection, where("subjectType", "==", "staff"), where("date", ">=", fromIso), where("date", "<=", toIso));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) } as AttendanceRecord));
}
