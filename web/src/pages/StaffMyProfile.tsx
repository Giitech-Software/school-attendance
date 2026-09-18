import { useRef, useState } from "react";
import { useCurrentStaff } from "../hooks/useCurrentStaff";
import { updateOwnStaffProfilePhoto } from "../services/staff";

export default function StaffMyProfile() {
  const { staff, loading } = useCurrentStaff();
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  function choosePhoto(file?: File) {
    if (!file || !staff?.id) return;
    setPhotoUrl(URL.createObjectURL(file));
    setPendingFile(file);
    setMessage("");
  }
  async function savePhoto() {
    if (!pendingFile || !staff?.id) return;
    setSaving(true); setMessage("");
    try {
      const updatedUrl = await updateOwnStaffProfilePhoto(staff.id, pendingFile);
      setPhotoUrl(`${updatedUrl}${updatedUrl.includes("?") ? "&" : "?"}v=${Date.now()}`);
      setPendingFile(null); setMessage("Profile photo updated successfully.");
    } catch (error: any) {
      setMessage(error?.code === "storage/unauthorized" ? "You can only update your own profile photo." : "Could not update profile photo. Please try again.");
    } finally { setSaving(false); }
  }

  if (loading) return <div className="enterprise-panel p-6">Loading profile…</div>;
  if (!staff) return <div className="enterprise-panel p-6">Your staff profile is not linked. Ask an administrator to link it.</div>;
  return <section className="enterprise-panel mx-auto max-w-xl p-5 sm:p-7">
    <h1 className="text-xl font-extrabold text-slate-950">My Profile</h1>
    <p className="mt-1 text-sm text-slate-600">View and update your profile picture.</p>
    <div className="mt-6 flex flex-col items-center rounded-2xl border border-slate-200 bg-slate-50 p-3 pt-2">
      {(photoUrl ?? staff.profilePhotoUrl) ? <img src={photoUrl ?? staff.profilePhotoUrl} alt={staff.name} className="h-72 w-72 max-w-full object-cover shadow-sm" /> : <div className="flex h-72 w-72 max-w-full items-center justify-center bg-slate-200 text-7xl font-bold text-slate-500">{staff.name?.charAt(0)?.toUpperCase()}</div>}
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={(e) => void choosePhoto(e.target.files?.[0])} />
      <input ref={cameraInputRef} type="file" accept="image/*" capture="user" className="hidden" onChange={(e) => void choosePhoto(e.target.files?.[0])} />
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        <button type="button" disabled={saving} onClick={() => cameraInputRef.current?.click()} className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60">{saving ? "Saving…" : "Take photo"}</button>
        <button type="button" disabled={saving} onClick={() => inputRef.current?.click()} className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-900 disabled:opacity-60">Choose from device</button>
      </div>
      {pendingFile && <button type="button" disabled={saving} onClick={() => void savePhoto()} className="mt-3 rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-60">{saving ? "Saving…" : "Save profile picture"}</button>}
      {message && <p className="mt-3 text-center text-sm font-semibold text-slate-700">{message}</p>}
    </div>
  </section>;
}
