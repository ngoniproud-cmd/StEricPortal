import { useState } from "react";
import { api, upload } from "../lib/api";
import { useFetch } from "../lib/hooks";
import { ErrorNote, Field, PageHeader, Select } from "../components/ui";

export default function Admin() {
  const [u, setU] = useState({ username: "", full_name: "", role: "teacher", phone: "" }); const [created, setCreated] = useState<any>(null); const [e1, setE1] = useState("");
  const [imp, setImp] = useState<any>(null); const [e2, setE2] = useState("");
  const classes = useFetch("/classes"); const [from, setFrom] = useState(""); const [to, setTo] = useState(""); const [pr, setPr] = useState<any>(null); const [e3, setE3] = useState("");
  const [link, setLink] = useState({ student: "", parent: "" }); const [lm, setLm] = useState(""); const stu = useFetch(from ? `/classes/${from}/students` : null);
  async function create() { setE1(""); setCreated(null); try { setCreated(await api("/users", { method: "POST", json: { ...u, phone: u.phone || null } })); } catch (e) { setE1((e as Error).message); } }
  async function importFile(f: File) { setE2(""); setImp(null); const fd = new FormData(); fd.append("file", f); try { setImp(await upload("/students/import", fd)); } catch (e) { setE2((e as Error).message); } }
  async function promote() { if (!confirm("Move every learner in this class up? This is done once a year.")) return; setE3(""); try { setPr(await api(`/classes/${from}/promote`, { method: "POST", json: { target_class_id: to } })); } catch (e) { setE3((e as Error).message); } }
  async function doLink() { setLm(""); try { await api(`/students/${link.student}/guardians`, { method: "POST", json: { parent_username: link.parent } }); setLm("Linked."); } catch (e) { setLm((e as Error).message); } }
  return (
    <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-2"><div className="lg:col-span-2"><PageHeader eyebrow="Office" title="Administration" sub="Accounts, learner records and year-end tasks." /></div>
      <section className="card space-y-3 p-5"><h2 className="font-display text-lg text-navy-800">Create an account</h2>
        <Field label="Full name"><input className="input" value={u.full_name} onChange={e => setU({ ...u, full_name: e.target.value })} /></Field>
        <div className="grid grid-cols-2 gap-3"><Field label="Username"><input className="input" value={u.username} onChange={e => setU({ ...u, username: e.target.value })} /></Field>
          <Field label="Role"><Select value={u.role} onChange={v => setU({ ...u, role: v })}>{["teacher", "librarian", "parent", "student", "admin"].map(r => <option key={r}>{r}</option>)}</Select></Field></div>
        <Field label="Phone (+263…)"><input className="input" value={u.phone} onChange={e => setU({ ...u, phone: e.target.value })} placeholder="+263771234567" /></Field>
        <button className="btn-primary" onClick={create} disabled={!u.username || !u.full_name}>Create account</button><ErrorNote msg={e1} />
        {created && <div className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900">Account <b>{created.username}</b> created. Temporary password: <b className="select-all font-mono">{created.temporary_password}</b><br /><span className="text-xs">Shown once. They must change it when they first sign in.</span></div>}</section>
      <section className="card space-y-3 p-5"><h2 className="font-display text-lg text-navy-800">Import learners from Excel</h2>
        <p className="text-sm text-mute">Columns: <code>admission_no, first_name, last_name, gender, class</code>. Classes must already exist.</p>
        <label className="btn-ghost cursor-pointer border border-line">Choose .xlsx or .csv<input type="file" hidden accept=".xlsx,.csv" onChange={ev => ev.target.files?.[0] && importFile(ev.target.files[0])} /></label><ErrorNote msg={e2} />
        {imp && <div className="text-sm"><p className="text-emerald-700">{imp.created} learners added.</p>{imp.errors.slice(0, 8).map((x: any) => <p key={x.row} className="text-red-700">Row {x.row}: {x.error}</p>)}</div>}</section>
      <section className="card space-y-3 p-5"><h2 className="font-display text-lg text-navy-800">Link a parent to a learner</h2>
        <Field label="Class"><Select value={from} onChange={setFrom}><option value="">Choose…</option>{(classes.data ?? []).map((c: any) => <option key={c.id} value={c.id}>{c.name} ({c.year})</option>)}</Select></Field>
        <Field label="Learner"><Select value={link.student} onChange={v => setLink({ ...link, student: v })}><option value="">Choose…</option>{(stu.data ?? []).map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select></Field>
        <Field label="Parent username"><input className="input" value={link.parent} onChange={e => setLink({ ...link, parent: e.target.value })} /></Field>
        <button className="btn-primary" onClick={doLink} disabled={!link.student || !link.parent}>Link</button>{lm && <p className={`text-sm ${lm === "Linked." ? "text-emerald-700" : "text-red-700"}`}>{lm}</p>}</section>
      <section className="card space-y-3 p-5"><h2 className="font-display text-lg text-navy-800">Year-end promotion</h2>
        <p className="text-sm text-mute">Moves all learners from the class chosen above into next year's class. Create next year's class first.</p>
        <Field label="Move up into"><Select value={to} onChange={setTo}><option value="">Choose…</option>{(classes.data ?? []).filter((c: any) => c.id !== from).map((c: any) => <option key={c.id} value={c.id}>{c.name} ({c.year})</option>)}</Select></Field>
        <button className="btn-primary" onClick={promote} disabled={!from || !to}>Promote class</button><ErrorNote msg={e3} />{pr && <p className="text-sm text-emerald-700">{pr.promoted} learners moved up.</p>}</section>
    </div>
  );
}
