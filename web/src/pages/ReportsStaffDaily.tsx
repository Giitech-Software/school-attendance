import StaffAttendanceReport from "../components/StaffAttendanceReport";

const today = new Date().toISOString().slice(0, 10);

export default function ReportsStaffDaily() {
  return (
    <StaffAttendanceReport
      title="Staff daily report"
      description="Review staff attendance counts for a single day."
      initialFrom={today}
      initialTo={today}
    />
  );
}




