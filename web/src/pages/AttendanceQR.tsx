import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { collection, doc, getDoc, getDocs, limit, query, where } from "firebase/firestore";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
import { db } from "../firebase";
import { listClasses, type ClassRecord } from "../services/classes";
import type { Student } from "../services/students";
import { registerAttendanceUnified } from "../services/attendance";
import { getStaffById, getStaffByStaffId } from "../services/staff";
import { registerStaffAttendance } from "../services/staffAttendance";
import { useCurrentStaff } from "../hooks/useCurrentStaff";

type ParsedQr = {
  studentId?: string;
  staffId?: string;
  userId?: string;
  role?: string;
  classId?: string;
  ts?: number;
  sig?: string;
};

function parseQRCodePayload(payload: string): ParsedQr {
  try {
    const parsed = JSON.parse(payload);
    if (typeof parsed === "object" && parsed !== null) return parsed;
  } catch {}
  return { studentId: payload.trim() };
}

async function sha256(data: string): Promise<string> {
  const bytes = new TextEncoder().encode(data);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function validateSignedPayload(payload: ParsedQr) {
  if (!payload.userId || !payload.role || payload.ts === undefined || !payload.sig) return false;
  const base = `${payload.userId}|${payload.role}|${payload.classId ?? ""}|${payload.ts}`;
  return (await sha256(base)) === payload.sig;
}

async function findStudentByScannedId(scannedId: string): Promise<Student | null> {
  const studentsRef = collection(db, "students");
  const byStudentId = await getDocs(query(studentsRef, where("studentId", "==", scannedId), limit(1)));
  if (!byStudentId.empty) return { id: byStudentId.docs[0].id, ...(byStudentId.docs[0].data() as any) } as Student;

  const byRollNo = await getDocs(query(studentsRef, where("rollNo", "==", scannedId), limit(1)));
  if (!byRollNo.empty) return { id: byRollNo.docs[0].id, ...(byRollNo.docs[0].data() as any) } as Student;

  const direct = await getDoc(doc(db, "students", scannedId));
  if (direct.exists()) return { id: direct.id, ...(direct.data() as any) } as Student;

  return null;
}

function classValue(cls: ClassRecord) {
  return cls.classId ?? cls.id ?? "";
}

export default function AttendanceQR() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const actor = searchParams.get("actor") === "staff" ? "staff" : "student";
  const mode = searchParams.get("mode") === "out" ? "out" : "in";
  const isSelfServiceStaff = actor === "staff" && searchParams.get("self") === "1";
  const { staff: currentStaff } = useCurrentStaff();
  const [qrCode, setQrCode] = useState("");
  const [classes, setClasses] = useState<ClassRecord[]>([]);
  const [selectedClassId, setSelectedClassId] = useState(searchParams.get("classId") ?? "");
  const [loading, setLoading] = useState(false);
  const loadingRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraStatus, setCameraStatus] = useState("Camera scanner is ready.");
  const [cameraError, setCameraError] = useState<string | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const scanLockedRef = useRef(false);
  const scannerElementId = "attendance-qr-camera";

  useEffect(() => {
    let active = true;
    listClasses()
      .then((rows) => {
        if (!active) return;
        setClasses(rows);
        if (!selectedClassId && rows.length > 0) setSelectedClassId(classValue(rows[0]));
      })
      .catch((err) => console.error("load classes for qr", err));
    return () => {
      active = false;
    };
  }, [selectedClassId]);

  const selectedClass = useMemo(
    () => classes.find((cls) => cls.id === selectedClassId || cls.classId === selectedClassId),
    [classes, selectedClassId]
  );

  const stopCameraScanner = useCallback(() => {
    const scanner = scannerRef.current;
    scannerRef.current = null;
    scanLockedRef.current = false;
    setCameraActive(false);
    if (!scanner) return;
    if (scanner.isScanning) {
      scanner.stop().then(() => scanner.clear()).catch((err) => console.warn("stop qr scanner", err));
    } else {
      scanner.clear();
    }
  }, []);

  useEffect(() => {
    return () => stopCameraScanner();
  }, [stopCameraScanner]);

  function changeActor(nextActor: "student" | "staff") {
    stopCameraScanner();
    setSearchParams({ actor: nextActor, mode, ...(nextActor === "student" && selectedClassId ? { classId: selectedClassId } : {}) });
    setError(null);
    setSuccess(null);
  }

  function changeMode(nextMode: "in" | "out") {
    stopCameraScanner();
    setSearchParams({ actor, mode: nextMode, ...(actor === "student" && selectedClassId ? { classId: selectedClassId } : {}), ...(isSelfServiceStaff ? { self: "1" } : {}) });
    setError(null);
    setSuccess(null);
  }

  const processQRCodeValue = useCallback(async (payload: string) => {
    const cleanPayload = payload.trim();
    if (!cleanPayload) {
      setError("Please enter a QR code value.");
      return;
    }
    if (loadingRef.current) return;

    loadingRef.current = true;
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const parsed = parseQRCodePayload(cleanPayload);
      const isSignedPayload = Boolean(parsed.userId && parsed.role && parsed.ts !== undefined && parsed.sig);

      if (isSignedPayload) {
        const valid = await validateSignedPayload(parsed);
        if (!valid) throw new Error("Signature validation failed.");
      }

      if (actor === "staff") {
        if (isSignedPayload && parsed.role !== "staff") throw new Error("This QR code is not for a staff member.");
        const scannedId = parsed.staffId ?? parsed.userId ?? parsed.studentId;
        if (!scannedId) throw new Error("This QR code does not contain a staff ID.");

        let staff = await getStaffByStaffId(scannedId);
        if (!staff && scannedId) staff = await getStaffById(scannedId);
        if (!staff?.id) throw new Error(`No staff record found for ID: ${scannedId}`);

        if (isSelfServiceStaff) {
          const ownIds = [currentStaff?.id, currentStaff?.staffId].filter(Boolean);
          if (!ownIds.includes(staff.id) && !ownIds.includes(staff.staffId)) {
            throw new Error("This QR code does not match your staff profile.");
          }
        }

        await registerStaffAttendance({ staffId: staff.id, mode, method: "qr", biometric: false });
        setSuccess(`${staff.name ?? "Staff member"} checked ${mode === "in" ? "in" : "out"} successfully.`);
      } else {
        const scannedId = parsed.studentId ?? parsed.userId;
        if (!scannedId) throw new Error("This QR code does not contain a student ID.");

        const finalClassId = selectedClassId || parsed.classId;
        if (!finalClassId) throw new Error("Select a class or include classId in the QR payload.");

        const student = await findStudentByScannedId(scannedId);
        if (!student?.id) throw new Error("Scanned ID does not match any student record.");

        await registerAttendanceUnified({
          studentId: student.id,
          classId: finalClassId,
          classDocId: selectedClass?.id,
          mode,
          method: "qr",
          biometric: false,
        });
        setSuccess(`${student.name ?? "Student"} checked ${mode === "in" ? "in" : "out"} successfully.`);
      }

      setQrCode("");
    } catch (err: any) {
      console.error("process qr code", err);
      setError(err?.message ?? "Failed to process QR code.");
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [actor, currentStaff?.id, currentStaff?.staffId, isSelfServiceStaff, mode, selectedClass?.id, selectedClassId]);

  async function handleQRSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await processQRCodeValue(qrCode);
  }

  const startCameraScanner = useCallback(async () => {
    stopCameraScanner();
    setCameraError(null);
    setError(null);
    setSuccess(null);

    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError("This browser cannot access a camera. Paste the QR payload below instead.");
      return;
    }

    try {
      const scanner = new Html5Qrcode(scannerElementId, {
        formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
        useBarCodeDetectorIfSupported: true,
        verbose: false,
      });
      scannerRef.current = scanner;
      setCameraActive(true);
      setCameraStatus("Point the camera at a QR card. Attendance will process automatically after a clear scan.");

      await scanner.start(
        { facingMode: "environment" },
        {
          fps: 8,
          qrbox: (viewfinderWidth, viewfinderHeight) => {
            const size = Math.floor(Math.min(viewfinderWidth, viewfinderHeight) * 0.72);
            return { width: Math.max(size, 180), height: Math.max(size, 180) };
          },
        },
        async (decodedText) => {
          if (scanLockedRef.current || loadingRef.current) return;
          scanLockedRef.current = true;
          setQrCode(decodedText);
          setCameraStatus("QR detected. Processing attendance...");
          stopCameraScanner();
          await processQRCodeValue(decodedText);
        },
        () => {
          setCameraError(null);
        }
      );
    } catch (err: any) {
      console.error("start camera qr scanner", err);
      stopCameraScanner();
      setCameraError(err?.message ?? "Could not start the camera. Check Chrome camera permission and try again.");
    }
  }, [processQRCodeValue, stopCameraScanner]);

  function handleClassChange(nextClassId: string) {
    stopCameraScanner();
    setSelectedClassId(nextClassId);
    setSearchParams({ actor, mode, classId: nextClassId });
  }

  return (
    <div className="mx-auto max-w-5xl space-y-3">
      <section className="enterprise-panel overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-slate-200 bg-slate-900 px-4 py-3 text-white sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-extrabold">{isSelfServiceStaff ? "Scan Your Staff QR" : actor === "staff" ? "Scan Staff QR" : "Scan Student QR"}</h1>
            <p className="mt-1 text-xs text-white/70">
              Point your scanner at the {isSelfServiceStaff ? "QR code linked to your profile" : actor === "staff" ? "staff member's QR code" : "student's QR code"} or paste the payload below.
            </p>
          </div>
          <button type="button" onClick={() => navigate(`/attendance/checkin?actor=${actor}&mode=${mode}`)} className="rounded-lg border border-white/20 px-3 py-2 text-sm font-semibold text-white hover:bg-white/10">
            Back
          </button>
        </div>
      </section>

      <section className="grid gap-3 xl:grid-cols-[1fr_21rem]">
        <form onSubmit={handleQRSubmit} className="enterprise-panel p-4">
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
              <select
                value={selectedClassId}
                onChange={(event) => {
                  handleClassChange(event.target.value);
                }}
                className="enterprise-input mt-1.5"
              >
                <option value="">Select class</option>
                {classes.map((cls) => (
                  <option key={cls.id} value={classValue(cls)}>
                    {cls.name} {cls.classId ? `(${cls.classId})` : ""}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-sm font-extrabold text-slate-950">Camera QR Scanner</h2>
                <p className="mt-1 text-xs text-slate-600">{cameraStatus}</p>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={startCameraScanner} disabled={loading || cameraActive} className="enterprise-button-primary">
                  {cameraActive ? "Scanning..." : "Use Camera"}
                </button>
                <button type="button" onClick={stopCameraScanner} disabled={!cameraActive} className="enterprise-button-secondary">
                  Stop
                </button>
              </div>
            </div>
            <div className="mt-3 overflow-hidden rounded-lg border border-slate-200 bg-slate-950">
              <div id={scannerElementId} className={`min-h-64 w-full ${cameraActive ? "block" : "hidden"}`} />
              {!cameraActive ? <div className="flex aspect-video items-center justify-center px-4 text-center text-sm font-semibold text-slate-300">Camera preview will appear here</div> : null}
            </div>
            {cameraError ? <div className="status-error mt-3">{cameraError}</div> : null}
          </div>

          <label className="mt-3 block">
            <span className="auth-label">QR Code Payload</span>
            <textarea
              value={qrCode}
              onChange={(event) => setQrCode(event.target.value)}
              placeholder={actor === "staff" ? `{"userId":"TCH-0001","role":"staff","ts":...,"sig":"..."}` : `{"studentId":"STU-001","classId":"grade-1a"} or STU-001`}
              className="mt-1.5 min-h-40 w-full resize-y rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-sm text-slate-900 shadow-sm outline-none focus:border-primary focus:ring-2 focus:ring-blue-900/10"
              autoFocus
            />
          </label>

          {error ? <div className="status-error mt-3">{error}</div> : null}
          {success ? <div className="status-success mt-3">{success}</div> : null}

          <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
            <button type="submit" disabled={loading} className="enterprise-button-primary">
              {loading ? "Processing..." : `Submit QR ${mode === "in" ? "Check-in" : "Check-out"}`}
            </button>
            <button type="button" onClick={() => setQrCode("")} disabled={loading || !qrCode} className="enterprise-button-secondary">
              Clear
            </button>
          </div>
        </form>

        <aside className="enterprise-panel p-4">
          <h2 className="text-base font-bold text-slate-950">Scanner Notes</h2>
          <div className="mt-3 space-y-2 text-sm text-slate-600">
            <p className="rounded-lg bg-slate-50 p-3">Use Camera starts a secure browser camera scan on supported devices.</p>
            <p className="rounded-lg bg-slate-50 p-3">If camera scanning is unavailable, the payload field remains available as a fallback.</p>
            <p className="rounded-lg bg-slate-50 p-3">Signed payloads are validated before staff attendance is recorded.</p>
            <p className="rounded-lg bg-slate-50 p-3">For student QR attendance, choose a class unless the payload includes classId.</p>
          </div>
          <div className="mt-3 grid gap-2">
            <Link to={`/attendance/checkin?actor=${actor}&mode=${mode}`} className="enterprise-button-secondary">
              Back to check-in
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

