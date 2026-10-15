import { useState } from "react";
import { Trash2 } from "lucide-react";
import { api, session } from "../lib/api";
import { useFetch } from "../lib/hooks";
import { Empty, ErrorNote, Field, PageHeader, Select, Spinner } from "../components/ui";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"];
function Grid({ slots, admin, reload }: { slots: any[]; admin?: boolean; reload?: () => void }) {
  const periods = Math.max(8, ...slots.map(s => s.period));
  return (<div className="card overflow-x-auto"><table className="w-full min-w-[640px] text-sm"><thead className="bg-navy-50 text-xs uppercase tracking-wide text-mute"><tr><th className="w-16 px-3 py-3 text-left">Period</th>{DAYS.map(d => <th key={d} className="px-3 py-3 text-left">{d}</th>)}</tr></thead>
    <tbody>{Array.from({ length: periods }, (_, i) => i + 1).map(p => <tr key={p} className="border-t border-line align-top"><td className="px-3 py-2 font-medium text-navy-700">{p}</td>{DAYS.map((_, d) => { const s = slots.find(x => x.day === d + 1 && x.period === p);
      return <td key={d} className="px-3 py-2">{s && <div className="rounded-lg bg-navy-50 p-2"><p className="font-medium text-navy-800">{s.subject}</p><p className="text-xs text-mute">{[s.class, s.teacher, s.room].filter(Boolean).join(" · ")}</p>
        {admin && <button aria-label="Remove lesson" className="mt-1 text-red-700" onClick={() => confirm("Remove this lesson?") && api(`/timetable/${s.id}`, { method: "DELETE" }).then(reload)}><Trash2 size={13} /></button>}</div>}</td>; })}</tr>)}</tbody></table></div>);
}

function Builder() {
  const classes = useFetch("/classes"); const subjects = useFetch("/subjects"); const teachers = useFetch("/users?role=teacher"); const [cid, setCid] = useState(""); const grid = useFetch(cid ? `/timetable/class/${cid}` : null);
  const [f, setF] = useState<any>({ day: "1", period: "1" }); const [err, setErr] = useState(""); const set = (k: string) => (v: string) => setF((s: any) => ({ ...s, [k]: v }));
  async function add() { setErr(""); try { await api("/timetable", { method: "POST", json: { class_id: cid, subject_id: f.subject_id, teacher_id: f.teacher_id, day: +f.day, period: +f.period, room: f.room || null } }); grid.reload(); } catch (e) { setErr((e as Error).message); } }
  return (<><div className="card mb-5 grid gap-3 p-4 sm:grid-cols-3"><Field label="Class"><Select value={cid} onChange={setCid}><option value="">Choose…</option>{(classes.data ?? []).map((c: any) => <option key={c.id} value={c.id}>{c.name} ({c.year})</option>)}</Select></Field>
    <Field label="Subject"><Select value={f.subject_id} onChange={set("subject_id")}><option value="">Choose…</option>{(subjects.data ?? []).map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select></Field>
    <Field label="Teacher"><Select value={f.teacher_id} onChange={set("teacher_id")}><option value="">Choose…</option>{(teachers.data ?? []).map((t: any) => <option key={t.id} value={t.id}>{t.full_name}</option>)}</Select></Field>
    <Field label="Day"><Select value={f.day} onChange={set("day")}>{DAYS.map((d, i) => <option key={d} value={i + 1}>{d}</option>)}</Select></Field>
    <Field label="Period"><Select value={f.period} onChange={set("period")}>{Array.from({ length: 10 }, (_, i) => <option key={i}>{i + 1}</option>)}</Select></Field>
    <Field label="Room (optional)"><input className="input" value={f.room ?? ""} onChange={e => set("room")(e.target.value)} /></Field>
    <div className="sm:col-span-3 flex items-center gap-3"><button className="btn-primary" disabled={!cid || !f.subject_id || !f.teacher_id} onClick={add}>Add lesson</button><ErrorNote msg={err} /></div></div>
    {cid && (grid.loading ? <Spinner /> : <Grid slots={grid.data ?? []} admin reload={grid.reload} />)}</>);
}

export default function Timetable() {
  const role = session.role(); const mine = useFetch(role === "admin" ? null : "/timetable/mine");
  return (<div className="mx-auto max-w-5xl"><PageHeader eyebrow="Lessons" title="Timetable" sub={role === "admin" ? "Build each class's week. Clashes are blocked automatically." : "Your week at a glance."} />
    {role === "admin" ? <Builder /> : mine.loading ? <Spinner /> : mine.error ? <ErrorNote msg={mine.error} /> : !(mine.data ?? []).some((t: any) => t.slots.length) ? <Empty title="No timetable yet" hint="It will appear here once the school publishes it." /> :
      <div className="space-y-6">{mine.data.map((t: any) => <section key={t.title}>{mine.data.length > 1 && <h2 className="mb-2 font-display text-lg text-navy-800">{t.title}</h2>}<Grid slots={t.slots} /></section>)}</div>}</div>);
}
