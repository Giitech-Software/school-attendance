// mobile/src/services/exports/exportStaffAttendancePdf.ts

import { doc, getDoc } from "firebase/firestore";
import { db } from "../../../app/firebase";

import {
  getStaffAttendanceInRange,
  getStaffGlobalSummary,
} from "../staffAttendanceSummary";

import { buildAttendancePdf } from "./buildAttendancePdf";
import { buildMobileDetailReport } from "./enterpriseAttendanceReport";

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
  const html = await buildMobileDetailReport({
    title: title ?? "Staff Attendance Report", subjectLabel: "Staff", fromIso, toIso,
    periodLabel: `${staffName} · ${fromIso} to ${toIso}`,
    rows: [{ staffName, ...(summary || {}) }],
    detailRows: records.map((record: any) => ({ date: record.date, status: record.status, checkInTime: record.checkInTime, checkOutTime: record.checkOutTime, movementEntry: [record.lateReason, record.earlyCheckoutReason].filter(Boolean).join(" / ") || null })),
  });

  /* ---------------------------------------------
     Generate PDF
  ---------------------------------------------- */
  await buildAttendancePdf({
    html,
    fileName: title ?? "Staff Attendance Report",
  });
}
