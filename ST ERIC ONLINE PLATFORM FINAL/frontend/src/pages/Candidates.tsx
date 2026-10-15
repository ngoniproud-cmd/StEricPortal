import { useState } from "react";
import { AlertTriangle, Plus, Printer } from "lucide-react";
import { api } from "../lib/api";
import { useFetch } from "../lib/hooks";
import { currentYear } from "../lib/zim";
import { Badge, Empty, ErrorNote, Field, PageHeader, Select, Spinner, useToast } from "../components/ui";

export default function Candidates() {
  const [year, setYear] = useState(String(currentYear())); const [cid, setCid] = useState(""); const classes = useFetch("/classes"); const subjects = useFetch("/subjects");
  const q = useFetch(`/candidates?year=${year}${cid ? `&class_id=${cid}` : ""}`); const toast = useToast();
  const [show, setShow] = useState(false); const [addClass, setAddClass] = useState(""); const students = useFetch(addClass ? `/classes/${addClass}/students` : null);
  const [f, setF] = useState<any>({ subjects: [] }); const [err, setErr] = useState("");
  const toggle = (id: string) => setF((s: any) => ({ ...s, subjects: s.subjects.includes(id) ? s.subjects.filter((x: string) => x !== id) : [...s.subjects, id] }));
  async function add() { setErr(""); try { await api("/candidates", { method: "POST", json: { student_id: f.student, year: +year, candidate_number: f.number || null, centre_number: f.centre || null, subject_ids: f.subjects } }); setShow(false); setF({ subjects: [] }); q.reload(); } catch (e) { setErr((e as Error).message); } }
  const patch = (id: string, body: any) => api(`/candidates/${id}`, { method: "PATCH", json: body }).then(q.reload).catch(e => toast.show(e.message));
  const rows: any[] = q.data ?? []; const flagged = rows.filter(r => r.issues.length).length;
  const eligible = (classes.data ?? []).filter((c: any) => c.form === 4 || c.form === 6);
  return (
    <div className="mx-auto max-w-5xl page-enter"><PageHeader eyebrow="Examinations" title="ZIMSEC Candidates"><button className="btn-ghost border border-line print:hidden" onClick={() => window.print()}><Printer size={16} />Print list</button><button className="btn-primary print:hidden" onClick={() => setShow(s => !s)}><Plus size={16} />Add candidate</button></PageHeader>
      <div className="card mb-5 grid gap-3 p-4 sm:grid-cols-3 print:hidden"><Field label="Exam year"><input type="number" className="input" value={year} onChange={e => setYear(e.target.value)} /></Field>
        <Field label="Class"><Select value={cid} onChange={setCid}><option value="">All classes</option>{eligible.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></Field>
        <div className="flex items-end text-sm text-mute">{rows.length} candidates{flagged ? <span className="ml-2 flex items-center gap-1 text-amber-700"><AlertTriangle size={14} />{flagged} need attention</span> : ""}</div></div>
      {show && <div className="card mb-5 space-y-3 p-5 print:hidden"><div className="grid gap-3 sm:grid-cols-2"><Field label="Class"><Select value={addClass} onChange={setAddClass}><option value="">Choose…</option>{eligible.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></Field>
        <Field label="Learner"><Select value={f.student} onChange={v => setF({ ...f, student: v })}><option value="">Choose…</option>{(students.data ?? []).map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select></Field>
        <Field label="Candidate number"><input className="input" value={f.number ?? ""} onChange={e => setF({ ...f, number: e.target.value })} /></Field><Field label="Centre number"><input className="input" value={f.centre ?? ""} onChange={e => setF({ ...f, centre: e.target.value })} /></Field></div>
        <div><span className="label">Subjects entered</span><div className="flex flex-wrap gap-2">{(subjects.data ?? []).map((s: any) => <label key={s.id} className={`cursor-pointer rounded-full border px-3 py-1.5 text-sm ${f.subjects.includes(s.id) ? "border-navy-700 bg-navy-800 text-white" : "border-line bg-white"}`}><input type="checkbox" hidden checked={f.subjects.includes(s.id)} onChange={() => toggle(s.id)} />{s.name}</label>)}</div></div>
        <div className="flex items-center gap-3"><button className="btn-primary" disabled={!f.student} onClick={add}>Save candidate</button><ErrorNote msg={err} /></div></div>}
      {q.loading ? <Spinner /> : q.error ? <ErrorNote msg={q.error} /> : !rows.length ? <Empty title="No candidates yet" hint="Add Form 4 and Form 6 learners as their entries are confirmed." /> : <div className="space-y-3">{rows.map(r => (
        <div key={r.id} className="card break-inside-avoid p-4"><div className="flex flex-wrap items-start justify-between gap-2"><div><p className="font-medium">{r.name} <span className="text-xs text-mute">{r.admission_no} · {r.class}</span></p>
          <p className="text-sm text-mute">Candidate no. {r.candidate_number ?? "–"} · Centre {r.centre_number ?? "–"}</p></div>
          <div className="flex items-center gap-2"><Badge tone={r.fees === "cleared" ? "green" : r.fees === "owing" ? "red" : "navy"}>Fees {r.fees}</Badge>
            <select aria-label="Status" className="input !w-auto !py-1.5 print:hidden" value={r.status} onChange={e => patch(r.id, { status: e.target.value })}><option value="entered">Entered</option><option value="fee_cleared">Fee cleared</option><option value="confirmed">Confirmed</option></select></div></div>
          <p className="mt-2 text-sm">{r.subjects.join(" · ") || "No subjects yet"}</p>
          {r.issues.length > 0 && <ul className="mt-2 space-y-1 text-sm text-amber-800">{r.issues.map((i: string) => <li key={i} className="flex items-center gap-2"><AlertTriangle size={14} />{i}</li>)}</ul>}</div>))}</div>}{toast.node}</div>
  );
}
