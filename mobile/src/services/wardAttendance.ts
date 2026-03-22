import { getWardsForParent } from "./wards";
import { getStudentById } from "./students";
import {
  computeAttendanceSummaryForStudent,
  AttendanceScope,
} from "./attendanceSummary";
import { listTerms } from "./terms";
import { listWeeks } from "./weeks";

/* ---------------- CORE ---------------- */

export async function getWardAttendanceByScope(
  parentUid: string,
  scope: AttendanceScope
) {
  const wards = await getWardsForParent(parentUid);
  if (!wards.length) return [];

  const today = new Date().toISOString().slice(0, 10);

  let fromIso = "";
  let toIso = today;

  switch (scope) {
    case "daily":
      fromIso = today;
      break;

    case "weekly": {
      const weeks = await listWeeks();
      const current = weeks.find(
        (w) => today >= w.startDate && today <= w.endDate
      );
      if (!current) return [];
      fromIso = current.startDate;
      toIso = current.endDate;
      break;
    }

    case "monthly": {
      const d = new Date();
      fromIso = new Date(d.getFullYear(), d.getMonth(), 1)
        .toISOString()
        .slice(0, 10);
      break;
    }

    case "termly": {
      const terms = await listTerms();
      const current = terms.find(
        (t) => today >= t.startDate && today <= t.endDate
      );
      if (!current) return [];
      fromIso = current.startDate;
      toIso = current.endDate;
      break;
    }
  }

  const out = [];

  for (const ward of wards) {
    const student = await getStudentById(ward.studentId);
    if (!student) continue;

    const summary = await computeAttendanceSummaryForStudent(
      ward.studentId,
      fromIso,
      toIso
    );

    out.push({
      studentId: ward.studentId,
      name: student.name,
      rollNo: student.rollNo ?? "",
      summary,
    });
  }

  return out;
}
