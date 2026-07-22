import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getAttendanceSettings, saveAttendanceSettings } from "../services/attendanceSettings";

function formatTo12Hour(time: string) {
  if (!/^[0-2][0-9]:[0-5][0-9]$/.test(time)) return time;
  const [hourStr, minute] = time.split(":");
  let hour = Number(hourStr);
  const suffix = hour >= 12 ? "PM" : "AM";
  hour = hour % 12 || 12;
  return `${hour}:${minute} ${suffix}`;
}

function isValidTime(time: string) {
  if (!/^[0-2][0-9]:[0-5][0-9]$/.test(time)) return false;
  const [hour, minute] = time.split(":").map(Number);
  return hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59;
}

export default function AdminAttendanceSettings() {
  const [lateAfter, setLateAfter] = useState("08:00");
  const [closeAfter, setCloseAfter] = useState("16:00");
  const [timezone, setTimezone] = useState("Africa/Accra");
  const [allowStaffWeekendAttendance, setAllowStaffWeekendAttendance] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    (async () => {
      try {
        const settings = await getAttendanceSettings();
        if (!active) return;
        setLateAfter(settings.lateAfter);
        setCloseAfter(settings.closeAfter);
        setTimezone(settings.timezone);
        setAllowStaffWeekendAttendance(settings.allowStaffWeekendAttendance);
      } catch (err) {
        console.error("load attendance settings", err);
        if (active) setError("Failed to load attendance settings.");
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  async function handleSave() {
    setStatus(null);
    setError(null);

    if (!isValidTime(lateAfter) || !isValidTime(closeAfter)) {
      setError("Use 24-hour HH:mm format for both late and close times.");
      return;
    }

    try {
      setSaving(true);
      await saveAttendanceSettings({ lateAfter, closeAfter, timezone, allowStaffWeekendAttendance });
      setStatus("Attendance settings saved successfully.");
    } catch (err) {
      console.error("save attendance settings", err);
      setError("Failed to save attendance settings.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      <section className="enterprise-panel overflow-hidden">
        <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-900 px-4 py-3 text-white">
          <Link to="/admin" className="rounded-lg border border-white/20 px-2.5 py-1 text-sm font-semibold text-white hover:bg-white/10" aria-label="Back to admin">
            Back
          </Link>
          <div>
            <h1 className="text-xl font-extrabold">Attendance Settings</h1>
            <p className="mt-1 text-xs text-white/70">Configure late check-in, closing time, weekend staff attendance, and the timezone used across web and mobile workflows.</p>
          </div>
        </div>
      </section>

      <section className="enterprise-panel p-4">
        {loading ? (
          <div className="text-slate-500">Loading settings...</div>
        ) : (
          <div className="space-y-3">
            <div className="grid gap-3 md:grid-cols-3">
              <div className="admin-field-card">
                <label className="auth-label">Late check-in time</label>
                <input value={lateAfter} onChange={(event) => setLateAfter(event.target.value)} placeholder="08:00" className="enterprise-input mt-3" />
                <p className="mt-2 text-sm font-semibold text-slate-500">Selected: {formatTo12Hour(lateAfter)}</p>
              </div>
              <div className="admin-field-card">
                <label className="auth-label">Attendance close time</label>
                <input value={closeAfter} onChange={(event) => setCloseAfter(event.target.value)} placeholder="16:00" className="enterprise-input mt-3" />
                <p className="mt-2 text-sm font-semibold text-slate-500">Selected: {formatTo12Hour(closeAfter)}</p>
              </div>
              <div className="admin-field-card">
                <label className="auth-label">Timezone</label>
                <input value={timezone} onChange={(event) => setTimezone(event.target.value)} placeholder="Africa/Accra" className="enterprise-input mt-3" />
                <p className="mt-2 text-sm text-slate-500">Used to interpret attendance timestamps.</p>
              </div>
              <label className="admin-field-card flex cursor-pointer items-start gap-3 md:col-span-3">
                <input
                  type="checkbox"
                  checked={allowStaffWeekendAttendance}
                  onChange={(event) => setAllowStaffWeekendAttendance(event.target.checked)}
                  className="mt-1 h-5 w-5 rounded border-slate-300 text-primary focus:ring-primary"
                />
                <span>
                  <span className="auth-label block">Allow staff weekend attendance</span>
                  <span className="mt-2 block text-sm text-slate-500">When enabled, staff can check in and check out on Saturdays and Sundays. Student attendance remains blocked on weekends.</span>
                </span>
              </label>
            </div>

            {error ? <div className="status-error">{error}</div> : null}
            {status ? <div className="status-success">{status}</div> : null}

            <button onClick={handleSave} disabled={saving} className="enterprise-button-primary">
              {saving ? "Saving..." : "Save Attendance Settings"}
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
