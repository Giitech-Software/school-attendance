import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { createStaffGroup, deleteStaffGroup, listStaffGroups, type StaffGroup } from "../services/staffGroups";

export default function StaffGroups() {
  const [rows, setRows] = useState<StaffGroup[]>([]); const [name, setName] = useState("");
  useEffect(() => { listStaffGroups().then(setRows).catch(console.error); }, []);
  async function add() { if (!name.trim()) return; const row = await createStaffGroup(name); setRows(r => [...r, row].sort((a,b) => a.name.localeCompare(b.name))); setName(""); }
  return <div className="mx-auto max-w-2xl space-y-3"><section className="enterprise-panel p-4"><Link to="/staff" className="text-sm font-semibold text-primary">← Staff</Link><h1 className="mt-2 text-xl font-extrabold">Staff groups</h1><p className="mt-1 text-sm text-slate-600">Create groups such as Preschool, Accounts, or Logistics.</p><div className="mt-4 flex gap-2"><input value={name} onChange={e => setName(e.target.value)} onKeyDown={e => e.key === "Enter" && add()} className="enterprise-input" placeholder="Group name" /><button type="button" onClick={add} className="enterprise-button-primary">Add</button></div></section><section className="enterprise-panel divide-y">{rows.map(row => <div key={row.id} className="flex items-center justify-between p-3"><span className="font-semibold">{row.name}</span><button type="button" onClick={async () => { if (window.confirm(`Delete ${row.name}?`)) { await deleteStaffGroup(row.id!); setRows(r => r.filter(x => x.id !== row.id)); } }} className="enterprise-button-danger">Delete</button></div>)}</section></div>;
}
