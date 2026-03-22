// mobile/src/services/exports/exportStaffAttendancePdf.ts

import { doc, getDoc } from "firebase/firestore";
import { db } from "../../../app/firebase";

import {
  getStaffAttendanceInRange,
  getStaffGlobalSummary,
} from "../staffAttendanceSummary";

import { staffAttendancePdfTemplate } from "./staffAttendancePdfTemplate";
import { buildAttendancePdf } from "./buildAttendancePdf";

export type ExportStaffPdfOptions = {
  staffId: string;
  fromIso: string;
  toIso: string;
  title?: string;
};

export async function exportStaffAttendancePdf(
  opts: ExportStaffPdfOptions
) {
  const { staffId, fromIso, toIso, title } = opts;

  /* ---------------------------------------------
     Resolve staff info
  ---------------------------------------------- */
  const snap = await getDoc(doc(db, "staff", staffId));

  let staffName = "Staff";

  if (snap.exists()) {
    const data = snap.data();
    const name = data.name ?? "Staff";
    const staffCode = data.staffId ?? "";

    staffName = staffCode
      ? `${name} (${staffCode})`
      : name;
  }

  /* ---------------------------------------------
     Load records (proper range query)
  ---------------------------------------------- */
  const records = await getStaffAttendanceInRange(
    staffId,
    fromIso,
    toIso
  );

  /* ---------------------------------------------
     Load summary
  ---------------------------------------------- */
  const summaries = await getStaffGlobalSummary(
    fromIso,
    toIso
  );

  const summary = summaries.find(
    (s) => s.staffId === staffId
  );

  /* ---------------------------------------------
     Build HTML
  ---------------------------------------------- */
  const html = staffAttendancePdfTemplate({
    title: title ?? "Staff Attendance Report",
    staffName,
    fromIso,
    toIso,
    summary: {
      presentCount: summary?.presentCount ?? 0,
      absentCount: summary?.absentCount ?? 0,
      lateCount: summary?.lateCount ?? 0,
      percentagePresent: summary?.percentagePresent ?? 0,
    },
    records,
  });

  /* ---------------------------------------------
     Generate PDF
  ---------------------------------------------- */
  await buildAttendancePdf({
    html,
    fileName: title ?? "Staff Attendance Report",
  });
}
