import ClassAttendanceReport from "../components/ClassAttendanceReport";

const year = new Date().getFullYear();
const initialFrom = `${year}-01-01`;
const initialTo = `${year}-12-31`;

export default function ReportsYearly() {
  return (
    <ClassAttendanceReport
      title="Yearly attendance report"
      description="Generate a full-year student attendance report and filter by class."
      initialFrom={initialFrom}
      initialTo={initialTo}
    />
  );
}
