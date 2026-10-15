import { useState } from "react";
import { Trash2 } from "lucide-react";
import { api } from "../lib/api";
import { useFetch } from "../lib/hooks";
import { currentYear, fmtDate } from "../lib/zim";
import { Badge, ErrorNote, Field, PageHeader, Select, Spinner, useToast } from "../components/ui";

const TABS = [["classes", "Classes"], ["subjects", "Subjects"], ["teaching", "Teaching"], ["grading", "Grading"], ["accounts", "Accounts"], ["audit", "Audit log"]] as const;

function Classes() {
  const q = useFetch("/classes"); const t = useFetch("/users?role=teacher"); const [f, setF] = useState<any>({ year: currentYear(), form: "1" }); const [err, setErr] = useState("");
  async function add() { setErr(""); try { await api("/classes", { method: "POST", json: { name: f.name, form: +f.form, year: +f.year, class_teacher_id: f.teacher || null } }); setF({ ...f, name: "" }); q.reload(); } catch (e) { setErr((e as Error).message); } }
  return (<><div className="card mb-4 grid gap-3 p-4 sm:grid-cols-4"><Field label="Name"><input className="input" placeholder="4 Blue" value={f.name ?? ""} onChange={e => setF({ ...f, name: e.target.value })} /></Field>
    <Field label="Form"><Select value={f.form} onChange={v => setF({ ...f, form: v })}>{[1, 2, 3, 4, 5, 6].map(n => <option key={n}>{n}</option>)}</Select></Field><Field label="Year"><input type="number" className="input" value={f.year} onChange={e => setF({ ...f, year: e.target.value })} /></Field>
    <Field label="Class teacher"><Select value={f.teacher} onChange={v => setF({ ...f, teacher: v })}><option value="">–</option>{(t.data ?? []).map((u: any) => <option key={u.id} value={u.id}>{u.full_name}</option>)}</Select></Field>
    <div className="sm:col-span-4 flex items-center gap-3"><button className="btn-primary" disabled={!f.name} onClick={add}>Add class</button><ErrorNote msg={err} /></div></div>
    {q.loading ? <Spinner /> : <div className="card divide-y divide-line">{(q.data ?? []).map((c: any) => <div key={c.id} className="flex items-center justify-between p-3 text-sm"><span><b>{c.name}</b> · Form {c.form} · {c.year}</span><span className="flex items-center gap-3 text-mute">{c.students} learners<button aria-label="Archive class" className="text-red-700" onClick={() => confirm("Archive this class?") && api(`/classes/${c.id}`, { method: "DELETE" }).then(q.reload).catch(e => setErr(e.message))}><Trash2 size={15} /></button></span></div>)}</div>}</>);
}
function Subjects() {
  const q = useFetch("/subjects"); const [f, setF] = useState<any>({ level: "O" }); const [err, setErr] = useState("");
  async function add() { setErr(""); try { await api("/subjects", { method: "POST", json: { name: f.name, zimsec_code: f.code || null, level: f.level } }); setF({ level: f.level }); q.reload(); } catch (e) { setErr((e as Error).message); } }
  return (<><div className="card mb-4 grid gap-3 p-4 sm:grid-cols-3"><Field label="Subject"><input className="input" value={f.name ?? ""} onChange={e => setF({ ...f, name: e.target.value })} /></Field><Field label="ZIMSEC syllabus code"><input className="input" value={f.code ?? ""} onChange={e => setF({ ...f, code: e.target.value })} /></Field>
    <Field label="Level"><Select value={f.level} onChange={v => setF({ ...f, level: v })}><option value="O">O-Level</option><option value="A">A-Level</option></Select></Field><div className="sm:col-span-3 flex items-center gap-3"><button className="btn-primary" disabled={!f.name} onClick={add}>Add subject</button><ErrorNote msg={err} /></div></div>
    {q.loading ? <Spinner /> : <div className="card divide-y divide-line">{(q.data ?? []).map((s: any) => <div key={s.id} className="flex items-center justify-between p-3 text-sm"><b>{s.name}</b><span className="flex items-center gap-3"><Badge>{s.level === "A" ? "A-Level" : "O-Level"}</Badge><button aria-label="Archive subject" className="text-red-700" onClick={() => confirm("Archive this subject?") && api(`/subjects/${s.id}`, { method: "DELETE" }).then(q.reload)}><Trash2 size={15} /></button></span></div>)}</div>}</>);
}
function Teaching() {
  const q = useFetch("/teacher-assignments"); const t = useFetch("/users?role=teacher"); const c = useFetch("/classes"); const s = useFetch("/subjects"); const [f, setF] = useState<any>({}); const [err, setErr] = useState("");
  async function add() { setErr(""); try { await api("/teacher-assignments", { method: "POST", json: { teacher_id: f.t, class_id: f.c, subject_id: f.s } }); q.reload(); } catch (e) { setErr((e as Error).message); } }
  const sel = (k: string, label: string, list: any[], name: (x: any) => string) => <Field label={label}><Select value={f[k]} onChange={v => setF({ ...f, [k]: v })}><option value="">Choose…</option>{list.map(x => <option key={x.id} value={x.id}>{name(x)}</option>)}</Select></Field>;
  return (<><div className="card mb-4 grid gap-3 p-4 sm:grid-cols-3">{sel("t", "Teacher", t.data ?? [], x => x.full_name)}{sel("c", "Class", c.data ?? [], x => `${x.name} (${x.year})`)}{sel("s", "Subject", s.data ?? [], x => x.name)}
    <div className="sm:col-span-3 flex items-center gap-3"><button className="btn-primary" disabled={!f.t || !f.c || !f.s} onClick={add}>Assign</button><ErrorNote msg={err} /></div></div>
    {q.loading ? <Spinner /> : <div className="card divide-y divide-line">{(q.data ?? []).map((a: any) => <div key={a.id} className="flex items-center justify-between p-3 text-sm"><span><b>{a.teacher}</b> teaches {a.subject} to {a.class}</span><button aria-label="Remove" className="text-red-700" onClick={() => api(`/teacher-assignments/${a.id}`, { method: "DELETE" }).then(q.reload)}><Trash2 size={15} /></button></div>)}</div>}</>);
}
function Grading() {
  const [level, setLevel] = useState("A"); const q = useFetch(`/grading/${level}`); const [bands, setBands] = useState<any[] | null>(null); const [err, setErr] = useState(""); const toast = useToast();
  const cur = bands ?? q.data?.bands;
  const setMin = (i: number, v: string) => { const b = (cur as any[]).map(x => ({ ...x })); b[i].min_pct = Number(v); if (b[i + 1]) b[i + 1].max_pct = Number(v) - 1; setBands(b); };
  async function save() { setErr(""); try { const r = await api(`/grading/${level}`, { method: "PUT", json: cur }); toast.show(r.note); setBands(null); q.reload(); } catch (e) { setErr((e as Error).message); } }
  return (<><p className="mb-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">These are the boundaries the school uses to turn marks into grades. Please confirm them against the current ZIMSEC circular. They can differ by subject and exam session.</p>
    <div className="mb-4 flex gap-2">{[["O", "O-Level (Forms 1-4)"], ["A", "A-Level (Forms 5-6)"]].map(([k, l]) => <button key={k} onClick={() => { setLevel(k); setBands(null); }} className={`btn ${level === k ? "bg-navy-800 text-white" : "border border-line bg-white"}`}>{l}</button>)}</div>
    {!cur ? <Spinner /> : <div className="card overflow-hidden"><table className="w-full text-sm"><thead className="bg-navy-50 text-left text-xs uppercase text-mute"><tr><th className="px-4 py-3">Grade</th><th>From %</th><th>To %</th>{level === "A" && <th>Points</th>}</tr></thead><tbody>{cur.map((b: any, i: number) => (
      <tr key={b.grade} className="border-t border-line"><td className="px-4 py-2 text-lg font-semibold text-navy-800">{b.grade}</td><td>{i === cur.length - 1 ? <span className="px-3">0</span> : <input type="number" min={0} max={100} className="input !w-24 !py-1.5" value={b.min_pct} onChange={e => setMin(i, e.target.value)} />}</td><td className="text-mute">{b.max_pct}</td>{level === "A" && <td>{b.points}</td>}</tr>))}</tbody></table>
      <div className="flex items-center gap-3 border-t border-line p-4"><button className="btn-primary" onClick={save} disabled={!bands}>Save boundaries</button><ErrorNote msg={err} /></div></div>}{toast.node}</>);
}
function Accounts() {
  const q = useFetch("/users"); const toast = useToast();
  async function toggle(u: any) { try { await api(`/users/${u.id}/status`, { method: "PATCH", json: { status: u.status === "active" ? "inactive" : "active" } }); q.reload(); } catch (e) { toast.show((e as Error).message); } }
  async function reset(u: any) { if (!confirm(`Reset the password for ${u.full_name}?`)) return; try { const r = await api(`/users/${u.id}/reset-password`, { method: "POST" }); alert(`Temporary password for ${u.username}: ${r.temporary_password}\n\nGive it to them now. It is shown only once.`); } catch (e) { toast.show((e as Error).message); } }
  return q.loading ? <Spinner /> : (<div className="card divide-y divide-line">{(q.data ?? []).map((u: any) => <div key={u.id} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm"><span><b>{u.full_name}</b> <span className="text-mute">@{u.username}</span></span>
    <span className="flex items-center gap-2"><Badge tone={u.status === "active" ? "green" : "red"}>{u.role}</Badge><button className="btn-ghost border border-line !py-1" onClick={() => reset(u)}>Reset password</button><button className="btn-ghost border border-line !py-1" onClick={() => toggle(u)}>{u.status === "active" ? "Deactivate" : "Activate"}</button></span></div>)}{toast.node}</div>);
}
function Audit() {
  const q = useFetch("/audit");
  return q.loading ? <Spinner /> : !(q.data ?? []).length ? <p className="text-sm text-mute">No changes recorded yet.</p> : (<div className="card divide-y divide-line">{q.data.map((a: any, i: number) => <div key={i} className="p-3 text-sm"><div className="flex justify-between gap-2"><b>{a.kind}</b><span className="text-xs text-mute">{fmtDate(a.when)}</span></div><p>{a.what}</p><p className="text-xs text-mute">By {a.who}{a.reason ? ` · Reason: ${a.reason}` : ""}</p></div>)}</div>);
}
export default function Setup() {
  const [tab, setTab] = useState<string>("classes"); const P: any = { classes: Classes, subjects: Subjects, teaching: Teaching, grading: Grading, accounts: Accounts, audit: Audit }[tab]; 
  return (<div className="mx-auto max-w-4xl"><PageHeader eyebrow="School setup" title="Setup" sub="Classes, subjects, who teaches what, grading and accounts." />
    <div className="mb-5 flex gap-1 overflow-x-auto border-b border-line">{TABS.map(([k, l]) => <button key={k} onClick={() => setTab(k)} className={`-mb-px shrink-0 border-b-2 px-4 py-2.5 text-sm font-medium ${tab === k ? "border-gold-500 text-navy-800" : "border-transparent text-mute hover:text-ink"}`}>{l}</button>)}</div><P /></div>);
}
