import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import FaceCameraCapture from "../components/FaceCameraCapture";
import { searchFace } from "../services/faceService";
import { listClasses, type ClassRecord } from "../services/classes";
import { getStudentById } from "../services/students";
import { getStaffById } from "../services/staff";
import { registerAttendanceUnified } from "../services/attendance";
import { registerStaffAttendance } from "../services/staffAttendance";
import { getAttendanceSettings } from "../services/attendanceSettings";
import { useCurrentStaff } from "../hooks/useCurrentStaff";


const LATE_REASON_GRACE_MINUTES = 60;
const LATE_REASON_OPTIONS = ["Transport or traffic disruption", "Health or medical matter", "Family or personal emergency", "Authorised organisational duty", "Severe weather or road conditions"];
const EARLY_CHECKOUT_REASON_OPTIONS = ["Authorised organisational assignment", "Medical appointment or health matter", "Family or personal emergency", "Approved early departure", "Transport or safety requirement"];
function parseTimeToMinutes(time?: string) {
  if (!time || !/^\d{2}:\d{2}$/.test(time)) return null;
  const [hour, minute] = time.split(":").map(Number);
  if (hour > 23 || minute > 59) return null;
  return hour * 60 + minute;
}
function minutesInTimezone(date: Date, timezone: string) {
  try {
    const parts = new Intl.DateTimeFormat("en-GB", { timeZone: timezone, hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(date);
    const hour = Number(parts.find((part) => part.type === "hour")?.value);
    const minute = Number(parts.find((part) => part.type === "minute")?.value);
    if (Number.isFinite(hour) && Number.isFinite(minute)) return hour * 60 + minute;
  } catch {}
  return date.getHours() * 60 + date.getMinutes();
}
async function promptMovementReason(mode: "in" | "out") {
  const settings = await getAttendanceSettings();
  const currentMinutes = minutesInTimezone(new Date(), settings.timezone || "Africa/Accra");
  const targetMinutes = parseTimeToMinutes(mode === "in" ? settings.lateAfter : settings.closeAfter);
  if (targetMinutes === null) return undefined;
  const minutes = mode === "in" ? currentMinutes - targetMinutes : targetMinutes - currentMinutes;
  const required = mode === "in" ? minutes >= LATE_REASON_GRACE_MINUTES : minutes > 0;
  if (!required) return undefined;
  const options = mode === "in" ? LATE_REASON_OPTIONS : EARLY_CHECKOUT_REASON_OPTIONS;
  const eventLabel = mode === "in" ? "late arrival" : "early departure";
  const timing = mode === "in" ? `${minutes} minutes after the scheduled time` : `${minutes} minutes before the scheduled closing time`;
  const answer = window.prompt(`Movement Book Entry — ${eventLabel}\n\nThis attendance event is ${timing}. Record an approved reason to complete the audit trail.\n\nApproved reason categories:\n${options.map((option, index) => `${index + 1}. ${option}`).join("\n")}\n\nEnter a category number or provide a clear authorised reason:`);
  if (answer === null) throw new Error("A movement book entry is required to complete this attendance action.");
  const trimmed = answer.trim();
  const selected = options[Number(trimmed) - 1];
  const reason = selected ?? trimmed;
  if (!reason) throw new Error("A movement book entry is required to complete this attendance action.");
  return reason;
}
function classValue(cls: ClassRecord) {
  return cls.classId ?? cls.id ?? "";
}

function similarityLabel(value?: number) {
  return typeof value === "number" ? ` (${value.toFixed(2)}% match)` : "";
}

export default function AttendanceFace() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const actor = searchParams.get("actor") === "staff" ? "staff" : "student";
  const mode = searchParams.get("mode") === "out" ? "out" : "in";
  const isSelfServiceStaff = actor === "staff" && searchParams.get("self") === "1";
  const { staff: currentStaff, loading: currentStaffLoading } = useCurrentStaff();
  const [classes, setClasses] = useState<ClassRecord[]>([]);
  const [selectedClassId, setSelectedClassId] = useState(searchParams.get("classId") ?? "");
  const [loadingClasses, setLoadingClasses] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    if (actor !== "student") return;
    setLoadingClasses(true);
    listClasses()
      .then((rows) => {
        if (!active) return;
        setClasses(rows);
        if (!selectedClassId && rows.length > 0) setSelectedClassId(classValue(rows[0]));
      })
      .catch((err) => {
        console.error("load classes for face", err);
        if (active) setError(err?.message ?? "Could not load classes.");
      })
      .finally(() => {
        if (active) setLoadingClasses(false);
      });
    return () => {
      active = false;
    };
  }, [actor, selectedClassId]);

  const selectedClass = useMemo(
    () => classes.find((cls) => cls.id === selectedClassId || cls.classId === selectedClassId),
    [classes, selectedClassId]
  );

  function changeActor(nextActor: "student" | "staff") {
    setSearchParams({ actor: nextActor, mode, ...(nextActor === "student" && selectedClassId ? { classId: selectedClassId } : {}), ...(isSelfServiceStaff ? { self: "1" } : {}) });
    setError(null);
    setSuccess(null);
  }

  function changeMode(nextMode: "in" | "out") {
    setSearchParams({ actor, mode: nextMode, ...(actor === "student" && selectedClassId ? { classId: selectedClassId } : {}), ...(isSelfServiceStaff ? { self: "1" } : {}) });
    setError(null);
    setSuccess(null);
  }

  function changeClass(nextClassId: string) {
    setSelectedClassId(nextClassId);
    setSearchParams({ actor, mode, classId: nextClassId });
  }

  async function handleCapture(base64Image: string) {
    if (actor === "student" && !selectedClassId) {
      setError("Select a class before using student face attendance.");
      return;
    }

    setProcessing(true);
    setError(null);
    setSuccess(null);
    try {
      const result = await searchFace(base64Image, actor);
      if (!result.matched || !result.subjectId) throw new Error("Face not recognized.");

      const movementReason = await promptMovementReason(mode);

      if (actor === "staff") {
        const matchedStaffId = result.subjectId;
        if (isSelfServiceStaff) {
          const ownIds = [currentStaff?.id, currentStaff?.staffId].filter(Boolean);
          if (!ownIds.includes(matchedStaffId)) throw new Error("The recognized face does not match your staff profile.");
        }
        const staff = await getStaffById(matchedStaffId);
        if (!staff?.id) throw new Error("Matched face is not registered as staff.");
        await registerStaffAttendance({ staffId: staff.id, mode, method: "face", biometric: true, movementReason });
        setSuccess(`${staff.name ?? "Staff member"} checked ${mode === "in" ? "in" : "out"} by face${similarityLabel(result.similarity)}.`);
      } else {
        const student = await getStudentById(result.subjectId);
        if (!student?.id) throw new Error("Matched face is not registered as a student.");
        await registerAttendanceUnified({
          studentId: student.id,
          classId: selectedClassId,
          classDocId: selectedClass?.id,
          mode,
          method: "face",
          biometric: true,
          movementReason,
        });
        setSuccess(`${student.name ?? "Student"} checked ${mode === "in" ? "in" : "out"} by face${similarityLabel(result.similarity)}.`);
      }
    } catch (err: any) {
      console.error("face attendance", err);
      setError(err?.message ?? "Face attendance failed.");
    } finally {
      setProcessing(false);
    }
  }

  const disabled = processing || (isSelfServiceStaff && currentStaffLoading);

  return (
    <div className="mx-auto max-w-5xl space-y-3">
      <section className="enterprise-panel overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-slate-200 bg-slate-900 px-4 py-3 text-white sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-extrabold">{actor === "staff" ? "Staff Face Attendance" : "Student Face Attendance"}</h1>
            <p className="mt-1 text-xs text-white/70">Use the front camera to verify a registered face for check-in or check-out.</p>
          </div>
          <button type="button" onClick={() => navigate(`/attendance/checkin?actor=${actor}&mode=${mode}`)} className="rounded-lg border border-white/20 px-3 py-2 text-sm font-semibold text-white hover:bg-white/10">
            Back
          </button>
        </div>
      </section>

      {error ? <div className="status-error">{error}</div> : null}
      {success ? <div className="status-success">{success}</div> : null}

      <section className="grid gap-3 lg:grid-cols-[1fr_20rem]">
        <div className="enterprise-panel p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <p className="auth-label mb-1.5">Subject</p>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => changeActor("student")} className={`rounded-lg border px-3 py-2 text-sm font-bold ${actor === "student" ? "border-primary bg-primary text-white" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`}>
                  Students
                </button>
                <button type="button" onClick={() => changeActor("staff")} className={`rounded-lg border px-3 py-2 text-sm font-bold ${actor === "staff" ? "border-primary bg-primary text-white" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`}>
                  Staff
                </button>
              </div>
            </div>

            <div>
              <p className="auth-label mb-1.5">Mode</p>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => changeMode("in")} className={`rounded-lg border px-3 py-2 text-sm font-bold ${mode === "in" ? "border-blue-600 bg-blue-600 text-white" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`}>
                  Check-in
                </button>
                <button type="button" onClick={() => changeMode("out")} className={`rounded-lg border px-3 py-2 text-sm font-bold ${mode === "out" ? "border-amber-600 bg-amber-600 text-white" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`}>
                  Check-out
                </button>
              </div>
            </div>
          </div>

          {actor === "student" ? (
            <label className="mt-3 block">
              <span className="auth-label">Class</span>
              <select value={selectedClassId} onChange={(event) => changeClass(event.target.value)} disabled={loadingClasses} className="enterprise-input mt-1.5">
                <option value="">Select class</option>
                {classes.map((cls) => (
                  <option key={cls.id} value={classValue(cls)}>
                    {cls.name} {cls.classId ? `(${cls.classId})` : ""}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          <div className="mt-3">
            <FaceCameraCapture disabled={disabled} captureLabel={processing ? "Verifying..." : `Face ${mode === "in" ? "Check-in" : "Check-out"}`} onCapture={handleCapture} />
          </div>
        </div>

        <aside className="enterprise-panel p-4">
          <h2 className="text-base font-bold text-slate-950">Face Notes</h2>
          <div className="mt-3 space-y-2 text-sm text-slate-600">
            <p className="rounded-lg bg-slate-50 p-3">The web camera captures one image and sends it to the same recognition function used by mobile.</p>
            <p className="rounded-lg bg-slate-50 p-3">Use a clear front-facing photo with good lighting.</p>
            <p className="rounded-lg bg-slate-50 p-3">If a face is not recognized, confirm the person has been registered first.</p>
          </div>
          <div className="mt-3 grid gap-2">
            <Link to={`/attendance/qr?actor=${actor}&mode=${mode}${actor === "student" && selectedClassId ? `&classId=${selectedClassId}` : ""}`} className="enterprise-button-secondary">
              Use QR instead
            </Link>
            <Link to="/attendance" className="enterprise-button-secondary">
              Today's Attendance
            </Link>
          </div>
        </aside>
      </section>
    </div>
  );
}
