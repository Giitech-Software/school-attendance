import ClassAttendanceReport from "../components/ClassAttendanceReport";

export default function ReportsDaily() {
  const today = new Date().toISOString().slice(0, 10);

  return (
    <ClassAttendanceReport
      title="Daily attendance report"
      description="Generate a report for a single day and review student attendance counts."
      initialFrom={today}
      initialTo={today}
    />
  );
}




