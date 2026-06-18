// web/src/App.tsx
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import Home from "./pages/Home";
import Login from "./pages/Login";
import ForgotPassword from "./pages/ForgotPassword";
import Signup from "./pages/Signup";
import Students from "./pages/Students";
import StudentsCreate from "./pages/StudentsCreate";
import StudentsBulkImport from "./pages/StudentsBulkImport";
import StudentDetail from "./pages/StudentDetail";
import StudentQrGenerator from "./pages/StudentQrGenerator";
import RegisterFaceStudent from "./pages/RegisterFaceStudent";
import RegisterFaceStaff from "./pages/RegisterFaceStaff";
import AttendanceFace from "./pages/AttendanceFace";
import EnrollBiometricStudent from "./pages/EnrollBiometricStudent";
import Staff from "./pages/Staff";
import StaffCreate from "./pages/StaffCreate";
import StaffBulkImport from "./pages/StaffBulkImport";
import StaffDetail from "./pages/StaffDetail";
import StaffMyAttendance from "./pages/StaffMyAttendance";
import StaffMyReport from "./pages/StaffMyReport";
import Terms from "./pages/Terms";
import TermCreate from "./pages/TermCreate";
import TermDetail from "./pages/TermDetail";
import Users from "./pages/Users";
import UserDetail from "./pages/UserDetail";
import Checkin from "./pages/Checkin";
import AttendanceList from "./pages/AttendanceList";
import AttendanceQR from "./pages/AttendanceQR";
import AttendanceStaffQrGenerator from "./pages/AttendanceStaffQrGenerator";
import Reports from "./pages/Reports";
import ReportsDaily from "./pages/ReportsDaily";
import ReportsWeekly from "./pages/ReportsWeekly";
import ReportsMonthly from "./pages/ReportsMonthly";
import ReportsTermly from "./pages/ReportsTermly";
import ReportsStaffDashboard from "./pages/ReportsStaffDashboard";
import ReportsStaffDetail from "./pages/ReportsStaffDetail";
import ReportsStaffDaily from "./pages/ReportsStaffDaily";
import ReportsStaffWeekly from "./pages/ReportsStaffWeekly";
import ReportsStaffMonthly from "./pages/ReportsStaffMonthly";
import ReportsStaffTermly from "./pages/ReportsStaffTermly";
import ReportsStudentDetail from "./pages/ReportsStudentDetail";
import AdminIndex from "./pages/AdminIndex";
import AdminClasses from "./pages/AdminClasses";
import AdminClassCreate from "./pages/AdminClassCreate";
import AdminClassDetail from "./pages/AdminClassDetail";
import AdminClassEdit from "./pages/AdminClassEdit";
import AdminAttendanceSettings from "./pages/AdminAttendanceSettings";
import AdminActivityLogs from "./pages/AdminActivityLogs";
import AdminPromoteStudents from "./pages/AdminPromoteStudents";
import AdminSetupSchoolLocation from "./pages/AdminSetupSchoolLocation";
import AdminUserManual from "./pages/AdminUserManual";
import NotFound from "./pages/NotFound";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="login" element={<Login />} />
          <Route path="forgot-password" element={<ForgotPassword />} />
          <Route path="signup" element={<Signup />} />

          <Route path="students">
            <Route index element={<Students />} />
            <Route path="create" element={<StudentsCreate />} />
            <Route path="bulk-import" element={<StudentsBulkImport />} />
            <Route path="qr-generator" element={<StudentQrGenerator />} />
            <Route path="register-face" element={<RegisterFaceStudent />} />
            <Route path="enroll-biometric" element={<EnrollBiometricStudent />} />
            <Route path=":id/qr" element={<StudentQrGenerator />} />
            <Route path=":id" element={<StudentDetail />} />
          </Route>

          <Route path="staff">
            <Route index element={<Staff />} />
            <Route path="create" element={<StaffCreate />} />
            <Route path="bulk-import" element={<StaffBulkImport />} />
            <Route path="my-attendance" element={<StaffMyAttendance />} />
            <Route path="my-report" element={<StaffMyReport />} />
            <Route path="register-face" element={<RegisterFaceStaff />} />
            <Route path=":id" element={<StaffDetail />} />
          </Route>

          <Route path="terms">
            <Route index element={<Terms />} />
            <Route path="create" element={<TermCreate />} />
            <Route path=":id" element={<TermDetail />} />
          </Route>

          <Route path="users">
            <Route index element={<Users />} />
            <Route path=":id" element={<UserDetail />} />
          </Route>

          <Route path="attendance">
            <Route index element={<AttendanceList />} />
            <Route path="checkin" element={<Checkin />} />
            <Route path="qr" element={<AttendanceQR />} />
            <Route path="face" element={<AttendanceFace />} />
            <Route path="staff-qr-generator" element={<AttendanceStaffQrGenerator />} />
          </Route>

          <Route path="reports">
            <Route index element={<Reports />} />
            <Route path="daily" element={<ReportsDaily />} />
            <Route path="weekly" element={<ReportsWeekly />} />
            <Route path="monthly" element={<ReportsMonthly />} />
            <Route path="termly" element={<ReportsTermly />} />
            <Route path="staff" element={<ReportsStaffDashboard />} />
            <Route path="staff/:id" element={<ReportsStaffDetail />} />
            <Route path="staff-daily" element={<ReportsStaffDaily />} />
            <Route path="staff-weekly" element={<ReportsStaffWeekly />} />
            <Route path="staff-monthly" element={<ReportsStaffMonthly />} />
            <Route path="staff-termly" element={<ReportsStaffTermly />} />
            <Route path="student/:id" element={<ReportsStudentDetail />} />
          </Route>

          <Route path="admin">
            <Route index element={<AdminIndex />} />
            <Route path="classes" element={<AdminClasses />} />
            <Route path="classes/create" element={<AdminClassCreate />} />
            <Route path="classes/:id" element={<AdminClassDetail />} />
            <Route path="classes/edit/:id" element={<AdminClassEdit />} />
            <Route path="attendance-settings" element={<AdminAttendanceSettings />} />
            <Route path="activity-logs" element={<AdminActivityLogs />} />
            <Route path="promote-students" element={<AdminPromoteStudents />} />
            <Route path="setup-school-location" element={<AdminSetupSchoolLocation />} />
            <Route path="user-manual" element={<AdminUserManual />} />
          </Route>

          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}




