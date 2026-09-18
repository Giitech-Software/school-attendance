import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { getStaffById, STAFF_ROLE_OPTIONS, uploadStaffProfilePhoto, upsertStaff, type Staff } from "../services/staff";
import { listStaffGroups, type StaffGroup } from "../services/staffGroups";
import useCurrentUser from "../hooks/useCurrentUser";
import { userFacingError } from "../services/userFacingError";

export default function StaffDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [staff, setStaff] = useState<Staff | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [groups, setGroups] = useState<StaffGroup[]>([]);
  const [photoUploading, setPhotoUploading] = useState(false);
  const { userDoc: currentUser } = useCurrentUser();
  const isSuperAdmin = currentUser?.role === "super_admin";
  useEffect(() => { listStaffGroups().then(setGroups).catch(console.error); }, []);

  useEffect(() => {
    let active = true;
    if (!id) return;

    getStaffById(id)
      .then((row) => {
        if (active) setStaff(row);
      })
      .catch((err) => {
        console.error(err);
        alert(userFacingError(err, "Unable to load staff details. Check your internet connection and try again."));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [id]);

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!staff?.id) return;
    setSaving(true);
    try {
      await upsertStaff({
        ...staff,
        name: staff.name.trim(),
        email: staff.email?.trim().toLowerCase(),
        staffId: staff.staffId?.trim().toUpperCase(),
      });
      navigate("/staff");
    } catch (err: any) {
      alert(userFacingError(err, "Could not save staff details. Check your internet connection and try again."));
    } finally {
      setSaving(false);
    }
  }

  async function handlePhoto(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file || !staff?.id) return;
    setPhotoUploading(true);
    try {
      const profilePhotoUrl = await uploadStaffProfilePhoto(staff.id, file);
      setStaff({ ...staff, profilePhotoUrl });
      await upsertStaff({ ...staff, profilePhotoUrl });
    } catch (err: any) { alert(userFacingError(err, "Profile photo upload failed. Check your internet connection and try again.")); }
    finally { setPhotoUploading(false); event.target.value = ""; }
  }

  if (loading) {
    return <div className="enterprise-panel p-4 text-sm text-slate-500">Loading staff member...</div>;
  }

  if (!staff) {
    return <div className="enterprise-panel p-4 text-sm text-slate-500">Staff not found.</div>;
  }

  const face = Boolean(staff.faceId || staff.faceEnrolled);
  const fingerprint = Boolean(staff.fingerprintId);

  return (
    <div className="mx-auto max-w-4xl space-y-3">
      <section className="enterprise-panel overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-slate-200 bg-slate-900 px-4 py-3 text-white sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Link to="/staff" className="rounded-lg border border-white/20 px-2.5 py-1 text-sm font-semibold text-white hover:bg-white/10" aria-label="Back to staff">
              Back
            </Link>
            <div>
              <h1 className="text-xl font-extrabold">Edit Staff</h1>
              <p className="mt-1 text-xs text-white/70">{staff.name ?? staff.staffId ?? "Staff profile"}</p>
            </div>
          </div>
          <label className="mt-3 block"><span className="auth-label">Staff group</span><select value={staff.staffGroupId ?? ""} onChange={e => setStaff({ ...staff, staffGroupId: e.target.value || undefined })} className="enterprise-input mt-1.5"><option value="">Unassigned</option>{groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}</select></label>
          <Link to={`/reports/staff/${staff.id}`} className="rounded-lg bg-white px-3 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100">
            View report
          </Link>
        </div>
      </section>

      <div className="grid gap-3 xl:grid-cols-[1fr_19rem]">
        <form onSubmit={handleSave} className="enterprise-panel p-4">
          <div className="grid gap-3 md:grid-cols-2">
            <label className="block md:col-span-2">
              <span className="auth-label">Full name</span>
              <input value={staff.name} onChange={(event) => setStaff({ ...staff, name: event.target.value })} className="enterprise-input mt-1.5" />
            </label>

            <label className="block">
              <span className="auth-label">Staff ID</span>
              <input value={staff.staffId ?? ""} onChange={(event) => setStaff({ ...staff, staffId: event.target.value.toUpperCase() || undefined })} className="enterprise-input mt-1.5" />
            </label>
            <label className="block md:col-span-2">
              <span className="auth-label">Profile photo</span>
              <input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={handlePhoto} disabled={photoUploading} className="enterprise-input mt-1.5" />
              <span className="mt-1 block text-xs text-slate-500">Choose an image or take a photo with your device camera. Compressed to a small JPEG thumbnail for fast loading.</span>
              {staff.profilePhotoUrl ? <img src={staff.profilePhotoUrl} alt={`${staff.name} profile`} className="mt-2 h-16 w-16 rounded-full object-cover" /> : null}
            </label>

            <label className="block">
              <span className="auth-label">Email</span>
              <input type="email" value={staff.email ?? ""} onChange={(event) => setStaff({ ...staff, email: event.target.value })} className="enterprise-input mt-1.5" />
            </label>
          </div>

          <div className="mt-4 admin-field-card">
            <p className="auth-label">Role</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {STAFF_ROLE_OPTIONS.map((option) => (
                <button key={option.value} type="button" onClick={() => setStaff({ ...staff, role: option.value, roleType: option.value })} className={`rounded-lg border px-3 py-2 text-sm font-semibold ${(staff.roleType ?? staff.role) === option.value ? "border-primary bg-primary text-white" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`}>
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {isSuperAdmin ? <label className="mt-3 block">
            <span className="auth-label">Linked User UID</span>
            <input value={staff.userUid ?? ""} readOnly className="enterprise-input mt-1.5 bg-slate-50 text-slate-600" placeholder="Not linked" />
          </label> : null}

          <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
            <button type="submit" disabled={saving} className="enterprise-button-primary">
              {saving ? "Saving..." : "Save"}
            </button>
            <button type="button" onClick={() => navigate("/staff")} className="enterprise-button-secondary">
              Cancel
            </button>
          </div>
        </form>

        <aside className="enterprise-panel p-4">
          <h2 className="text-base font-bold text-slate-950">Enrollment Status</h2>
          <div className="mt-3 space-y-2">
            <div className={`rounded-lg border p-3 ${face ? "border-emerald-200 bg-emerald-50" : "border-slate-200 bg-slate-50"}`}>
              <p className="text-sm font-bold text-slate-900">Face</p>
              <p className="text-sm text-slate-600">{face ? "Enrolled" : "Not enrolled"}</p>
            </div>
            <div className={`rounded-lg border p-3 ${fingerprint ? "border-blue-200 bg-blue-50" : "border-slate-200 bg-slate-50"}`}>
              <p className="text-sm font-bold text-slate-900">Fingerprint</p>
              <p className="text-sm text-slate-600">{fingerprint ? "Enrolled" : "Not enrolled"}</p>
            </div>
          </div>
          <p className="mt-3 rounded-lg bg-blue-50 p-3 text-sm text-blue-700">Face enrollment can be captured on web with a camera. Fingerprint enrollment remains device-specific.</p>
          <div className="mt-3 grid gap-2">
            <Link to={`/staff/register-face?staffId=${staff.id}`} className="enterprise-button-primary">
              {face ? "Update Face" : "Register Face"}
            </Link>
            <Link to={`/staff/enroll-biometric?id=${staff.id}`} className="enterprise-button-secondary">
              Fingerprint instructions
            </Link>
            <Link to="/attendance/staff-qr-generator" className="enterprise-button-secondary">
              Staff QRs
            </Link>
          </div>
        </aside>
      </div>
    </div>
  );
}

