import { Link } from "react-router-dom";

const sections = [
  {
    title: "Account Access",
    items: [
      "Sign in with email and password.",
      "New users must verify email and wait for admin approval.",
      "Use Forgot password to receive a reset link.",
      "If the verification email is missing, check inbox first, then spam or junk.",
    ],
  },
  {
    title: "Home Page",
    items: [
      "Use attendance actions to start student or staff attendance.",
      "Use Reports for daily, weekly, monthly, termly, yearly, and individual summaries.",
      "Use Admin to manage setup, users, students, staff, and classes.",
    ],
  },
  {
    title: "Attendance",
    items: [
      "Student attendance supports class selection, QR, biometric, and face check-in/out where configured.",
      "Staff attendance supports QR, face, biometric, and staff ID attendance where configured.",
      "After the configured attendance close time, check-in is blocked but check-out remains available.",
      "Late arrivals and early departures require a movement book entry when they cross the configured attendance threshold.",
    ],
  },
  {
    title: "Admin Setup",
    items: [
      "Set Attendance Time to configure late time, close time, timezone, weekend/holiday policy, and absence marking.",
      "Manage Terms, Classes, Students, Staff, Users, Parent Wards, and the User Manual from Admin.",
      "Use Promote Students to move selected active students without deleting attendance history.",
    ],
  },
  {
    title: "Students",
    items: [
      "Create or edit students with name, class, student ID, and roll number.",
      "Use Bulk Import to paste CSV rows with name, classId or className, studentId, and rollNo.",
      "Generate student QR codes individually or export printable QR cards.",
      "Open each student profile to view enrollment and report links.",
    ],
  },
  {
    title: "Staff",
    items: [
      "Create or edit staff with name, staff ID, email, and role.",
      "Link staff records to matching user accounts when possible.",
      "Generate professional signed staff QR cards with print/PDF output from the staff QR page.",
      "Staff users can view My Attendance and My Report where enabled.",
    ],
  },
  {
    title: "Users and Parents",
    items: [
      "Admins can edit user roles, approval, display names, and attendance permissions.",
      "Use Wards to assign students to parent accounts.",
      "Any verified and approved mobile login can sign in to the web with the same credentials.",
    ],
  },
  {
    title: "Reports",
    items: [
      "Choose Student Reports or Staff Reports.",
      "Open daily, weekly, monthly, termly, yearly, or individual reports.",
      "Weekly reports use generated weeks from the current term.",
      "Report pages show Present, Late, Attended, Absent, and Attendance % totals; daily reports can auto-mark absentees before showing results.",
    ],
  },
];

const commonIssues = [
  ["Cannot sign in", "Check email and password, verify email, or reset password."],
  ["Account pending", "Ask an administrator to approve the account."],
  ["Check-in closed", "Check-in is blocked after the close time; use check-out only if the person already checked in."],
  ["QR not accepted", "Confirm the QR belongs to the correct student or staff member."],
  ["Parent sees no wards", "Assign wards to the parent account."],
  ["Reports are empty", "Confirm terms, weeks, students, staff, classes, and attendance or absent records exist for the selected range."],
];

export default function AdminUserManual() {
  return (
    <div className="space-y-3">
      <section className="enterprise-panel overflow-hidden">
        <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-900 px-4 py-3 text-white">
          <Link to="/admin" className="rounded-lg border border-white/20 px-2.5 py-1 text-sm font-semibold text-white hover:bg-white/10" aria-label="Back to admin">
            Back
          </Link>
          <div>
            <h1 className="text-xl font-extrabold">User Manual</h1>
            <p className="mt-1 text-xs text-white/70">Concise guide for the web and mobile attendance workflows.</p>
          </div>
        </div>
      </section>

      <div className="grid gap-3 lg:grid-cols-2">
        {sections.map((section) => (
          <section key={section.title} className="admin-card">
            <h2 className="text-lg font-extrabold text-slate-950">{section.title}</h2>
            <div className="mt-3 space-y-2">
              {section.items.map((item) => (
                <div key={item} className="flex gap-2 text-sm leading-6 text-slate-700">
                  <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-primary" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>

      <section className="enterprise-panel p-4">
        <h2 className="text-lg font-extrabold text-slate-950">Common Issues</h2>
        <div className="mt-3 divide-y divide-slate-100">
          {commonIssues.map(([issue, fix]) => (
            <div key={issue} className="py-3">
              <div className="font-bold text-slate-800">{issue}</div>
              <div className="mt-1 text-sm text-slate-600">{fix}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}


