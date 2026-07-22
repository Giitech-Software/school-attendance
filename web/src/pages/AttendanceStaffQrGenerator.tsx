import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { listStaff } from "../services/staff";

type StaffRecord = {
  id: string;
  name?: string;
  staffId?: string;
  email?: string;
  role?: string;
};

function staffLabel(staff: StaffRecord) {
  return staff.name ?? staff.email ?? staff.staffId ?? staff.id;
}

function staffQrId(staff: StaffRecord) {
  return staff.staffId ?? staff.id;
}

function staffQrValue(staff: StaffRecord) {
  return JSON.stringify({ staffId: staffQrId(staff), role: "staff" });
}

function qrImageUrl(value: string, size = 260) {
  const encoded = encodeURIComponent(value);
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&ecc=H&margin=12&data=${encoded}`;
}

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export default function AttendanceStaffQrGenerator() {
  const [loading, setLoading] = useState(true);
  const [staffList, setStaffList] = useState<StaffRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStaff, setSelectedStaff] = useState<StaffRecord | null>(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    let active = true;

    (async () => {
      try {
        const rows = await listStaff();
        if (active) {
          setStaffList(
            rows
              .filter((item) => Boolean(item.id))
              .map((item) => ({ ...item, id: item.id as string }))
              .sort((a, b) => staffLabel(a).localeCompare(staffLabel(b)))
          );
        }
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

  function openQrForStaff(staff: StaffRecord) {
    setSelectedStaff(staff);
  }

  function printStaffCards(staff: StaffRecord[]) {
    if (staff.length === 0) return;
    setExporting(true);
    try {
      const cards = staff
        .map((item) => {
          const name = escapeHtml(staffLabel(item));
          const id = escapeHtml(staffQrId(item));
          const email = item.email ? `<div class="email">${escapeHtml(item.email)}</div>` : "";
          const src = qrImageUrl(staffQrValue(item), 220);
          return `
            <article class="card">
              <div class="brand">ASTEM Attendance Register</div>
              <img src="${src}" alt="Staff QR for ${name}" />
              <h2>${name}</h2>
              <div class="id">Staff ID: ${id}</div>
              ${email}
              <div class="footer">Staff Attendance QR</div>
            </article>
          `;
        })
        .join("");

      const html = `
        <!doctype html>
        <html>
          <head>
            <title>Staff QR Cards</title>
            <style>
              @page { size: A4; margin: 12mm; }
              * { box-sizing: border-box; }
              body { margin: 0; font-family: Arial, sans-serif; color: #0f172a; background: #fff; }
              .sheet { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
              .card { break-inside: avoid; min-height: 320px; border: 1px solid #e2e8f0; border-radius: 14px; padding: 14px; text-align: center; background: #fff; }
              .brand { font-size: 10px; font-weight: 800; letter-spacing: .12em; text-transform: uppercase; color: #4f46e5; }
              img { display: block; width: 170px; height: 170px; margin: 14px auto 10px; }
              h2 { margin: 0; font-size: 16px; line-height: 1.2; }
              .id { margin-top: 6px; font-size: 12px; font-weight: 700; color: #334155; }
              .email { margin-top: 4px; font-size: 10px; color: #64748b; word-break: break-word; }
              .footer { margin-top: 12px; border-top: 1px solid #e2e8f0; padding-top: 9px; font-size: 10px; font-weight: 800; letter-spacing: .12em; text-transform: uppercase; color: #64748b; }
            </style>
          </head>
          <body>
            <main class="sheet">${cards}</main>
            <script>
              async function waitForImages() {
                const images = Array.from(document.images);
                await Promise.all(images.map((image) => {
                  if (image.complete) return Promise.resolve();
                  return new Promise((resolve) => {
                    image.onload = resolve;
                    image.onerror = resolve;
                  });
                }));
              }
              window.addEventListener('load', async () => {
                await waitForImages();
                setTimeout(() => window.print(), 250);
              });
            </script>
          </body>
        </html>
      `;

      const win = window.open("", "_blank");
      if (!win) throw new Error("Popup blocked. Allow popups and try again.");
      win.opener = null;
      win.document.open();
      win.document.write(html);
      win.document.close();
    } catch (err: any) {
      console.error(err);
      alert(err?.message ?? "Could not prepare staff QR cards.");
    } finally {
      setExporting(false);
    }
  }

  if (loading) {
    return <div className="enterprise-panel p-4 text-sm text-slate-500">Loading staff...</div>;
  }

  const selectedQrValue = selectedStaff ? staffQrValue(selectedStaff) : "";

  return (
    <div className="space-y-3">
      <section className="enterprise-panel overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-slate-200 bg-slate-900 px-4 py-3 text-white sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Link to="/staff" className="rounded-lg border border-white/20 px-2.5 py-1 text-sm font-semibold text-white hover:bg-white/10" aria-label="Back to staff">
                Back
              </Link>
              <h1 className="truncate text-xl font-extrabold">Staff QR Cards</h1>
            </div>
            <p className="mt-1 text-xs text-white/70">Generate printable staff QR cards for camera attendance.</p>
          </div>
          <button type="button" onClick={() => printStaffCards(filteredStaff)} disabled={exporting || filteredStaff.length === 0} className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white hover:bg-primary-dark disabled:opacity-60">
            {exporting ? "Preparing..." : "Print / PDF"}
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
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-bold text-slate-950">{staffLabel(staff)}</p>
                      <div className="mt-1 flex flex-wrap gap-2 text-xs font-semibold text-slate-600">
                        <span className="rounded bg-white px-2 py-1">Staff ID: {staffQrId(staff)}</span>
                        {staff.role ? <span className="rounded bg-white px-2 py-1">Role: {staff.role}</span> : null}
                      </div>
                    </div>
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-indigo-100 text-lg font-black text-indigo-700">QR</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <aside className="enterprise-panel p-4">
          {selectedStaff ? (
            <>
              <div className="rounded-xl border border-indigo-100 bg-white p-4 text-center shadow-sm">
                <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-indigo-700">ASTEM Attendance Register</p>
                <img src={qrImageUrl(selectedQrValue, 300)} alt={`Staff QR for ${staffLabel(selectedStaff)}`} className="mx-auto mt-4 h-64 w-64 rounded-xl border-4 border-indigo-50 bg-white p-3" />
                <h2 className="mt-4 text-lg font-extrabold text-slate-950">{staffLabel(selectedStaff)}</h2>
                <p className="mt-1 text-sm font-bold text-slate-600">Staff ID: {staffQrId(selectedStaff)}</p>
                {selectedStaff.email ? <p className="mt-1 break-words text-xs text-slate-500">{selectedStaff.email}</p> : null}
                <p className="mt-4 border-t border-slate-100 pt-3 text-[11px] font-extrabold uppercase tracking-[0.16em] text-slate-500">Staff Attendance QR</p>
              </div>

              <button type="button" onClick={() => printStaffCards([selectedStaff])} className="mt-3 w-full enterprise-button-primary">
                Print selected card
              </button>
              <Link to="/attendance/checkin" className="mt-3 w-full enterprise-button-secondary">
                Back to check-in
              </Link>
            </>
          ) : (
            <p className="text-sm text-slate-500">Select a staff member to preview and print a QR card.</p>
          )}
        </aside>
      </section>
    </div>
  );
}




