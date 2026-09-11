import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../firebase";
import { getTenantScope, tenantConstraints } from "./tenantScope";

export type AttendanceAuditRow = { personId: string; displayId?: string; late: number; early: number; missingSignOut: number; lastDate: string };

export async function getAttendanceAudit(fromIso: string, toIso: string): Promise<AttendanceAuditRow[]> {
  const scope = await getTenantScope();
  const snapshot = await getDocs(query(collection(db, "attendance"), where("date", ">=", fromIso), where("date", "<=", toIso), ...tenantConstraints(scope)));
  const rows = new Map<string, AttendanceAuditRow>();
  snapshot.docs.forEach((item) => {
    const data = item.data() as Record<string, any>;
    const personId = String(data.staffId || data.studentId || data.subjectId || "");
    if (!personId) return;
    const row = rows.get(personId) || { personId, late: 0, early: 0, missingSignOut: 0, lastDate: "" };
    if (data.status === "late") row.late += 1;
    if (data.earlyCheckoutReason || data.earlyDeparture) row.early += 1;
    if (data.checkInTime && !data.checkOutTime && data.status !== "absent") row.missingSignOut += 1;
    row.lastDate = String(data.date || row.lastDate);
    rows.set(personId, row);
  });
  return [...rows.values()].sort((a, b) => b.late + b.early + b.missingSignOut - (a.late + a.early + a.missingSignOut));
}
