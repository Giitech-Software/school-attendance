import { useRef, useState } from "react";
import useCurrentUser from "../hooks/useCurrentUser";
import { uploadOwnProfilePhoto } from "../services/users";
import { auth, db } from "../firebase";
import { doc, updateDoc } from "firebase/firestore";

export default function AdminMyProfile() {
  const { userDoc, loading } = useCurrentUser(); const inputRef = useRef<HTMLInputElement>(null); const [preview, setPreview] = useState<string | null>(null); const [saving, setSaving] = useState(false);
  if (loading) return <div className="enterprise-panel p-6">Loading profile…</div>;
  const uid = auth.currentUser?.uid; if (!uid || !userDoc) return <div className="enterprise-panel p-6">Profile unavailable.</div>;
  async function save(file?: File) { if (!file) return; setPreview(URL.createObjectURL(file)); setSaving(true); try { const url = await uploadOwnProfilePhoto(uid!, file); await updateDoc(doc(db, "users", uid!), { profilePhotoUrl: url }); } finally { setSaving(false); } }
  return <section className="enterprise-panel mx-auto max-w-xl p-5"><h1 className="text-xl font-extrabold">My Profile</h1><p className="mt-1 text-sm text-slate-600">Update your administrator profile picture.</p><div className="mt-5 flex flex-col items-center rounded-2xl bg-slate-50 p-3 pt-2"><img src={preview ?? (userDoc as any).profilePhotoUrl ?? ""} className="h-72 w-72 max-w-full bg-slate-200 object-cover" alt="Profile" /><input ref={inputRef} type="file" accept="image/*" capture="user" className="hidden" onChange={(e) => void save(e.target.files?.[0])} /><button type="button" disabled={saving} onClick={() => inputRef.current?.click()} className="mt-4 rounded-lg bg-slate-900 px-4 py-2.5 font-bold text-white">{saving ? "Saving…" : "Take or choose photo"}</button></div></section>;
}
