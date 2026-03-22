// web/src/pages/Home.tsx
import { type JSX } from "react";

export default function Home(): JSX.Element {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
      <div className="max-w-2xl w-full bg-white rounded-2xl shadow-lg p-8">
        <h1 className="text-3xl font-bold mb-4">ASTEM — Attendance</h1>
        <p className="text-slate-600 mb-6">
          Welcome to the admin console. Use the navigation to manage students and run attendance.
        </p>

        <div className="flex gap-3">
          <a href="/students" className="px-4 py-2 rounded-lg bg-primary text-white">Students</a>
          <a href="/checkin" className="px-4 py-2 rounded-lg border">Check-in</a>
          <a href="/reports" className="px-4 py-2 rounded-lg border">Reports</a>
        </div>
      </div>
    </div>
  );
}
