// web/src/pages/Reports.tsx
import { useState, type JSX } from "react";
import type { AttendanceSummary } from "../services/attendanceSummary";
import { computeClassSummary } from "../services/attendanceSummary";

function isoDateDaysAgo(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

export default function Reports(): JSX.Element {
  const [classId, setClassId] = useState<string>("");
  const [from, setFrom] = useState<string>(isoDateDaysAgo(7));
  const [to, setTo] = useState<string>(new Date().toISOString().slice(0, 10));
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<AttendanceSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onGenerate() {
    setError(null);
    setResults(null);
    setLoading(true);
    try {
      const res = await computeClassSummary(classId || "", from, to);
      setResults(res);
    } catch (err: any) {
      setError(err?.message ?? String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-6 min-h-screen bg-slate-50">
      <div className="max-w-4xl mx-auto bg-white p-6 rounded-2xl shadow">
        <h1 className="text-2xl font-semibold mb-4">Attendance Reports</h1>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
          <input
            placeholder="Class ID (optional)"
            value={classId}
            onChange={(e) => setClassId(e.target.value)}
            className="p-3 border rounded"
          />
          <div>
            <label className="text-sm text-slate-600">From</label>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="w-full p-2 border rounded"
            />
          </div>
          <div>
            <label className="text-sm text-slate-600">To</label>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="w-full p-2 border rounded"
            />
          </div>

          <div className="flex items-end">
            <button
              onClick={onGenerate}
              className="w-full bg-primary text-white py-2 rounded"
              disabled={loading}
            >
              {loading ? "Generating…" : "Generate Report"}
            </button>
          </div>
        </div>

        {error && <div className="text-red-600 mb-3">{error}</div>}

        {!results && !loading && (
          <div className="text-sm text-slate-500">Enter a class (optional) and date range, then click Generate.</div>
        )}

        {results && (
          <div className="mt-4">
            <div className="overflow-x-auto">
              <table className="w-full table-auto border-collapse">
                <thead>
                  <tr className="text-left border-b">
                    <th className="py-2 px-2">Student ID</th>
                    <th className="py-2 px-2">Present</th>
                    <th className="py-2 px-2">Absent</th>
                    <th className="py-2 px-2">Late</th>
                    <th className="py-2 px-2">Total</th>
                    <th className="py-2 px-2">% Present</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((r) => (
                    <tr key={r.studentId} className="border-b">
                      <td className="py-2 px-2">{r.studentId}</td>
                      <td className="py-2 px-2">{r.presentCount}</td>
                      <td className="py-2 px-2">{r.absentCount}</td>
                      <td className="py-2 px-2">{r.lateCount}</td>
                      <td className="py-2 px-2">{r.totalSessions}</td>
                      <td className="py-2 px-2">{r.percentagePresent.toFixed(2)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
