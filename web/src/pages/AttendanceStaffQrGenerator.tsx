import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { collection, getDocs, orderBy, query } from "firebase/firestore";
import { db } from "../firebase";

type StaffRecord = {
  id: string;
  name?: string;
  staffId?: string;
  email?: string;
  role?: string;
};

type QrPayload = {
  userId: string;
  role: "staff";
  ts: number;
  sig: string;
};

async function sha256(data: string): Promise<string> {
  const bytes = new TextEncoder().encode(data);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function generateStaffQrPayload(staffId: string): Promise<QrPayload> {
  const ts = Date.now();
  const base = `${staffId}|staff||${ts}`;
  return {
    userId: staffId,
    role: "staff",
    ts,
    sig: await sha256(base),
  };
}

function staffLabel(staff: StaffRecord) {
  return staff.name ?? staff.email ?? staff.staffId ?? staff.id;
}

export default function AttendanceStaffQrGenerator() {
  const [loading, setLoading] = useState(true);
  const [staffList, setStaffList] = useState<StaffRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStaff, setSelectedStaff] = useState<StaffRecord | null>(null);
  const [payloadJson, setPayloadJson] = useState("");
  const [copied, setCopied] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    let active = true;

    (async () => {
      try {
        const q = query(collection(db, "staff"), orderBy("name", "asc"));
        const snap = await getDocs(q);
        if (active) setStaffList(snap.docs.map((doc) => ({ id: doc.id, ...(doc.data() as any) })));
      } catch (err) {
        console.error(err);
        alert("Failed to load staff.");
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  const filteredStaff = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return staffList;
    return staffList.filter((staff) =>
      [staff.name, staff.staffId, staff.email].some((value) => (value ?? "").toLowerCase().includes(q))
    );
  }, [staffList, searchQuery]);

  async function openQrForStaff(staff: StaffRecord) {
    const payload = await generateStaffQrPayload(staff.staffId ?? staff.id);
    setSelectedStaff(staff);
    setPayloadJson(JSON.stringify(payload));
    setCopied(false);
  }

  async function copyToClipboard() {
    await navigator.clipboard.writeText(payloadJson);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function exportPayloads() {
    if (filteredStaff.length === 0) return;

    setExporting(true);
    try {
      const rows = await Promise.all(
        filteredStaff.map(async (staff) => ({
          name: staffLabel(staff),
          staffId: staff.staffId ?? staff.id,
          payload: await generateStaffQrPayload(staff.staffId ?? staff.id),
        }))
      );
      const blob = new Blob([JSON.stringify(rows, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "staff-qr-payloads.json";
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      alert("Could not export staff QR payloads.");
    } finally {
      setExporting(false);
    }
  }

  if (loading) {
    return <div className="enterprise-panel p-4 text-sm text-slate-500">Loading staff...</div>;
  }

  return (
    <div className="space-y-3">
      <section className="enterprise-panel overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-slate-200 bg-slate-900 px-4 py-3 text-white sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Link to="/staff" className="rounded-lg border border-white/20 px-2.5 py-1 text-sm font-semibold text-white hover:bg-white/10" aria-label="Back to staff">
                Back
              </Link>
              <h1 className="truncate text-xl font-extrabold">Staff QRs</h1>
            </div>
            <p className="mt-1 text-xs text-white/70">Select staff members and generate signed attendance payloads.</p>
          </div>
          <button type="button" onClick={exportPayloads} disabled={exporting || filteredStaff.length === 0} className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white hover:bg-primary-dark disabled:opacity-60">
            {exporting ? "Exporting..." : "Export JSON"}
          </button>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        {[
          ["Staff", staffList.length],
          ["Filtered", filteredStaff.length],
          ["Selected", selectedStaff ? staffLabel(selectedStaff) : "None"],
        ].map(([label, value]) => (
          <div key={label} className="enterprise-panel p-3">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p>
            <p className="mt-1 truncate text-2xl font-extrabold text-slate-950">{value}</p>
          </div>
        ))}
      </section>

      <section className="grid gap-3 lg:grid-cols-[1fr_26rem]">
        <div className="enterprise-panel p-3">
          <div className="mb-3 grid gap-3 lg:grid-cols-[1fr_auto] lg:items-center">
            <h2 className="text-base font-extrabold text-slate-950">Staff</h2>
            <input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search name or ID..." className="enterprise-input lg:w-96" />
          </div>

          {filteredStaff.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-5 text-center text-sm text-slate-500">No staff found.</div>
          ) : (
            <div className="grid gap-2">
              {filteredStaff.map((staff) => (
                <button key={staff.id} type="button" onClick={() => openQrForStaff(staff)} className={`rounded-lg border p-3 text-left transition ${selectedStaff?.id === staff.id ? "border-primary bg-blue-50" : "border-slate-200 bg-slate-50 hover:border-primary"}`}>
                  <p className="font-bold text-slate-950">{staffLabel(staff)}</p>
                  <div className="mt-1 flex flex-wrap gap-2 text-xs font-semibold text-slate-600">
                    <span className="rounded bg-white px-2 py-1">Staff ID: {staff.staffId ?? staff.id}</span>
                    {staff.role ? <span className="rounded bg-white px-2 py-1">Role: {staff.role}</span> : null}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <aside className="enterprise-panel p-4">
          {selectedStaff ? (
            <>
              <h2 className="text-base font-extrabold text-slate-950">{staffLabel(selectedStaff)}</h2>
              <div className="mt-2 flex flex-wrap gap-2 text-xs font-semibold text-slate-600">
                <span className="rounded bg-slate-50 px-2 py-1">Staff ID: {selectedStaff.staffId ?? selectedStaff.id}</span>
                {selectedStaff.email ? <span className="rounded bg-slate-50 px-2 py-1">{selectedStaff.email}</span> : null}
              </div>

              <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="mb-2 text-sm font-semibold text-slate-700">QR payload JSON</p>
                <div className="max-h-48 overflow-auto break-all rounded-lg border border-slate-300 bg-white p-3 font-mono text-xs">{payloadJson}</div>
                <button type="button" onClick={copyToClipboard} className="mt-3 w-full enterprise-button-secondary">
                  {copied ? "Copied!" : "Copy JSON"}
                </button>
              </div>

              <Link to="/attendance/checkin" className="mt-3 w-full enterprise-button-secondary">
                Back to check-in
              </Link>
            </>
          ) : (
            <p className="text-sm text-slate-500">Select a staff member to generate a QR payload.</p>
          )}
        </aside>
      </section>
    </div>
  );
}

