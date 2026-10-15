import { useState } from "react";
import { AlertTriangle, ArrowLeft, Paperclip, Plus } from "lucide-react";
import { api, openFile, session, upload } from "../lib/api";
import { useFetch } from "../lib/hooks";
import { currentTerm, currentYear, fmtDate } from "../lib/zim";
import { Badge, Empty, ErrorNote, Field, PageHeader, Select, Spinner, useToast } from "../components/ui";

const when = (iso: string) => new Date(iso).toLocaleString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

function Create({ onDone }: { onDone: () => void }) {
  const classes = useFetch("/classes"); const subjects = useFetch("/subjects"); const [f, setF] = useState<any>({}); const [file, setFile] = useState<File | null>(null); const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  const set = (k: string) => (v: string) => setF((s: any) => ({ ...s, [k]: v }));
  async function go() { setBusy(true); setErr(""); const fd = new FormData();
    fd.append("class_id", f.class_id); fd.append("subject_id", f.subject_id); fd.append("title", f.title); fd.append("due_at", new Date(f.due).toISOString());
    if (f.max_marks) fd.append("max_marks", f.max_marks); if (f.instructions) fd.append("instructions", f.instructions); if (file) fd.append("file", file);
    try { await upload("/assignments", fd); onDone(); } catch (e) { setErr((e as Error).message); } finally { setBusy(false); } }
  return (<div className="card mb-6 grid gap-3 p-5 sm:grid-cols-2">
    <Field label="Class"><Select value={f.class_id} onChange={set("class_id")}><option value="">Choose…</option>{(classes.data ?? []).map((c: any) => <option key={c.id} value={c.id}>{c.name} ({c.year})</option>)}</Select></Field>
    <Field label="Subject"><Select value={f.subject_id} onChange={set("subject_id")}><option value="">Choose…</option>{(subjects.data ?? []).map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select></Field>
    <div className="sm:col-span-2"><Field label="Title"><input className="input" value={f.title ?? ""} onChange={e => set("title")(e.target.value)} /></Field></div>
    <Field label="Due"><input type="datetime-local" className="input" value={f.due ?? ""} onChange={e => set("due")(e.target.value)} /></Field>
    <Field label="Out of (optional)"><input type="number" min={1} className="input" value={f.max_marks ?? ""} onChange={e => set("max_marks")(e.target.value)} /></Field>
    <div className="sm:col-span-2"><Field label="Instructions"><textarea className="input min-h-20" value={f.instructions ?? ""} onChange={e => set("instructions")(e.target.value)} /></Field></div>
    <div className="sm:col-span-2"><label className="btn-ghost cursor-pointer border border-dashed border-navy-300"><Paperclip size={16} />{file ? file.name : "Attach a file (optional)"}<input hidden type="file" onChange={e => setFile(e.target.files?.[0] ?? null)} /></label></div>
    <div className="sm:col-span-2 flex items-center gap-3"><button className="btn-primary" disabled={busy || !f.class_id || !f.subject_id || !f.due || (f.title ?? "").length < 3} onClick={go}>Post homework</button><ErrorNote msg={err} /></div></div>);
}

function Review({ a, back }: { a: any; back: () => void }) {
  const q = useFetch(`/assignments/${a.id}/submissions`); const toast = useToast(); const [edit, setEdit] = useState<Record<string, any>>({}); const [term, setTerm] = useState(String(currentTerm()));
  const set = (id: string, k: string, v: any) => setEdit(e => ({ ...e, [id]: { ...e[id], [k]: v } }));
  async function save(r: any) { const d = edit[r.student_id] ?? {}; try { await api(`/assignments/${a.id}/submissions/${r.student_id}/mark`, { method: "PUT", json: { mark: d.mark === "" || d.mark === undefined ? r.mark : Number(d.mark), feedback: d.feedback ?? r.feedback } }); toast.show("Saved."); q.reload(); } catch (e) { toast.show((e as Error).message); } }
  async function send() { try { const r = await api(`/assignments/${a.id}/to-assessment?term=${term}&year=${currentYear()}`, { method: "POST" }); toast.show(`${r.saved} marks copied to Mark entry.`); } catch (e) { toast.show((e as Error).message); } }
  return (<div className="mx-auto max-w-4xl"><button className="btn-ghost mb-3" onClick={back}><ArrowLeft size={16} />All homework</button>
    <PageHeader eyebrow="Marking" title={a.title} sub={`${a.class} · ${a.subject} · due ${when(a.due_at)}`}>{a.max_marks && <><Select value={term} onChange={setTerm}>{[1, 2, 3].map(t => <option key={t}>{t}</option>)}</Select><button className="btn-primary" onClick={send}>Send marks to Mark entry</button></>}</PageHeader>
    {q.loading ? <Spinner /> : q.error ? <ErrorNote msg={q.error} /> : <div className="space-y-3">{q.data.rows.map((r: any) => (
      <div key={r.student_id} className="card p-4"><div className="flex flex-wrap items-center justify-between gap-2"><div><p className="font-medium">{r.name}</p><p className="text-xs text-mute">{r.admission_no}</p></div>
        {r.submitted ? <Badge tone={r.late ? "amber" : "green"}>{r.late ? "Handed in late" : "Handed in"} · {fmtDate(r.submitted_at)}</Badge> : <Badge tone="red">Not handed in</Badge>}</div>
        {r.submitted && <div className="mt-3 space-y-3">{r.text && <p className="whitespace-pre-line rounded-lg bg-paper p-3 text-sm">{r.text}</p>}
          {r.file_name && <button className="btn-ghost border border-line !py-1.5 text-sm" onClick={() => openFile(`/assignments/${a.id}/submissions/${r.student_id}/file`).catch(e => toast.show(e.message))}><Paperclip size={14} />{r.file_name}</button>}
          <div className="grid gap-2 sm:grid-cols-[110px_1fr_auto]"><input type="number" min={0} max={a.max_marks ?? undefined} className="input" placeholder={a.max_marks ? `/ ${a.max_marks}` : "Mark"} defaultValue={r.mark ?? ""} onChange={e => set(r.student_id, "mark", e.target.value)} />
            <input className="input" placeholder="Feedback for the learner" defaultValue={r.feedback ?? ""} onChange={e => set(r.student_id, "feedback", e.target.value)} /><button className="btn-primary" onClick={() => save(r)}>Save</button></div></div>}</div>))}</div>}{toast.node}</div>);
}

function Planner() {
  const classes = useFetch("/classes"); const [cid, setCid] = useState(""); const p = useFetch(cid ? `/assignments/planner?class_id=${cid}` : null);
  return (<div className="card mb-6 p-5"><div className="mb-3 flex flex-wrap items-center justify-between gap-3"><h2 className="font-display text-lg text-navy-800">This week's workload</h2><div className="w-52"><Select value={cid} onChange={setCid}><option value="">Choose a class…</option>{(classes.data ?? []).map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></div></div>
    {!cid ? <p className="text-sm text-mute">Choose a class to see what is due and avoid piling work on one day.</p> : p.loading ? <Spinner /> : !p.data.days.length ? <p className="text-sm text-mute">Nothing due this week.</p> : <div className="space-y-2">
      {p.data.warnings.map((w: string) => <p key={w} className="flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900"><AlertTriangle size={16} />{w}</p>)}
      {p.data.days.map((d: any) => <div key={d.date} className="flex flex-wrap items-center gap-2 border-t border-line pt-2 text-sm"><b className="w-24">{fmtDate(d.date)}</b>{d.items.map((i: any, k: number) => <Badge key={k} tone={i.kind === "exam" ? "red" : d.overloaded ? "amber" : "navy"}>{i.subject ? `${i.subject}: ` : ""}{i.title}</Badge>)}</div>)}</div>}</div>);
}

function Mine({ list, reload }: { list: any[]; reload: () => void }) {
  const role = session.role(); const toast = useToast(); const [open, setOpen] = useState(""); const [text, setText] = useState(""); const [file, setFile] = useState<File | null>(null); const [busy, setBusy] = useState(false);
  async function submit(id: string) { setBusy(true); const fd = new FormData(); if (text) fd.append("text", text); if (file) fd.append("file", file);
    try { const r = await upload(`/assignments/${id}/submit`, fd); toast.show(r.late ? "Handed in (marked late)." : "Handed in. Well done!"); setOpen(""); setText(""); setFile(null); reload(); } catch (e) { toast.show((e as Error).message); } finally { setBusy(false); } }
  if (!list.length) return <Empty title="No homework right now" hint="New homework from your teachers will appear here." />;
  return (<div className="space-y-3">{list.map(a => { const s = a.submission; return (
    <div key={a.id + (a.student?.id ?? "")} className="card p-4"><div className="flex flex-wrap items-start justify-between gap-2"><div><p className="font-medium">{a.title}</p><p className="text-sm text-mute">{a.subject} · due {when(a.due_at)}{a.student && role === "parent" ? ` · ${a.student.name}` : ""}</p></div>
      {s ? (s.mark != null ? <Badge tone="green">Marked{a.max_marks ? `: ${s.mark}/${a.max_marks}` : `: ${s.mark}`}</Badge> : <Badge tone={s.late ? "amber" : "green"}>{s.late ? "Handed in late" : "Handed in"}</Badge>) : <Badge tone={a.overdue ? "red" : "gold"}>{a.overdue ? "Overdue" : "To do"}</Badge>}</div>
      {a.instructions && <p className="mt-2 whitespace-pre-line text-sm text-mute">{a.instructions}</p>}
      {a.has_attachment && <button className="btn-ghost mt-2 border border-line !py-1.5 text-sm" onClick={() => openFile(`/assignments/${a.id}/attachment`).catch(e => toast.show(e.message))}><Paperclip size={14} />Open worksheet</button>}
      {s?.feedback && <p className="mt-3 rounded-lg bg-gold-100/60 p-3 text-sm"><b>Teacher feedback:</b> {s.feedback}</p>}
      {role === "student" && !(s && s.mark != null) && (open === a.id ? <div className="mt-3 space-y-2"><textarea className="input min-h-24" placeholder="Type your answer (optional if you attach a file)" value={text} onChange={e => setText(e.target.value)} />
        <label className="btn-ghost cursor-pointer border border-dashed border-navy-300"><Paperclip size={16} />{file ? file.name : "Attach your work"}<input hidden type="file" onChange={e => setFile(e.target.files?.[0] ?? null)} /></label>
        <div className="flex gap-2"><button className="btn-primary" disabled={busy || (!text && !file)} onClick={() => submit(a.id)}>{busy ? "Sending…" : "Hand in"}</button><button className="btn-ghost" onClick={() => setOpen("")}>Cancel</button></div></div>
        : <button className="btn-primary mt-3" onClick={() => setOpen(a.id)}>{s ? "Hand in again" : "Hand in"}</button>)}</div>); })}{toast.node}</div>);
}

export default function Assignments() {
  const role = session.role(); const staff = role === "teacher" || role === "admin"; const q = useFetch("/assignments"); const [show, setShow] = useState(false); const [sel, setSel] = useState<any>(null);
  if (sel) return <Review a={sel} back={() => { setSel(null); q.reload(); }} />;
  return (
    <div className="mx-auto max-w-4xl"><PageHeader eyebrow="Learning" title="Homework" sub={staff ? "Post work, mark it and give feedback." : "Everything due, in one place."}>{staff && <button className="btn-primary" onClick={() => setShow(s => !s)}><Plus size={16} />Post homework</button>}</PageHeader>
      {staff && show && <Create onDone={() => { setShow(false); q.reload(); }} />}{staff && <Planner />}
      {q.loading ? <Spinner /> : q.error ? <ErrorNote msg={q.error} /> : staff ? ((q.data ?? []).length ? <div className="grid gap-3 sm:grid-cols-2">{q.data.map((a: any) => <button key={a.id} onClick={() => setSel(a)} className="card p-4 text-left transition hover:shadow-lg">
        <div className="flex justify-between gap-2"><p className="font-medium">{a.title}</p><Badge tone={a.submitted === a.total ? "green" : "amber"}>{a.submitted}/{a.total}</Badge></div><p className="text-sm text-mute">{a.class} · {a.subject} · due {when(a.due_at)}</p></button>)}</div> : <Empty title="No homework posted yet" />) : <Mine list={q.data ?? []} reload={q.reload} />}
    </div>
  );
}
