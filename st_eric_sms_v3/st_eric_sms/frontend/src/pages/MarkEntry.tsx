import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { CheckCircle2, CloudOff, Plus, Upload } from "lucide-react";
import { api, upload } from "../lib/api";
import { gradeFor } from "../lib/grading";
import { useFetch } from "../lib/hooks";
import { currentTerm, currentYear } from "../lib/zim";
import { Badge, Empty, ErrorNote, Field, PageHeader, Select, Spinner, gradeTone, useToast } from "../components/ui";

type Row = { student_id: string; admission_no: string; name: string; marks_obtained: number | null; absent: boolean };

function NewAssessment({ onDone }: { onDone: () => void }) {
  const { data: classes } = useFetch("/classes"); const { data: subjects } = useFetch("/subjects");
  const [f, setF] = useState<any>({ term: currentTerm(), year: currentYear(), kind: "test", max_marks: 50 }); const [err, setErr] = useState("");
  const set = (k: string) => (v: string) => setF((s: any) => ({ ...s, [k]: v }));
  async function create() { setErr(""); try { await api("/assessments", { method: "POST", json: { ...f, term: +f.term, year: +f.year, max_marks: +f.max_marks } }); onDone(); } catch (e) { setErr((e as Error).message); } }
  return (<div className="card mb-6 grid gap-3 p-5 sm:grid-cols-3">
    <Field label="Class"><Select value={f.class_id} onChange={set("class_id")}><option value="">Choose…</option>{(classes ?? []).map((c: any) => <option key={c.id} value={c.id}>{c.name} ({c.year})</option>)}</Select></Field>
    <Field label="Subject"><Select value={f.subject_id} onChange={set("subject_id")}><option value="">Choose…</option>{(subjects ?? []).map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select></Field>
    <Field label="Title"><input className="input" value={f.title ?? ""} onChange={e => set("title")(e.target.value)} placeholder="Term 1 Test 1" /></Field>
    <Field label="Type"><Select value={f.kind} onChange={set("kind")}><option value="test">Test</option><option value="assignment">Assignment</option><option value="exam">Exam</option></Select></Field>
    <Field label="Term"><Select value={f.term} onChange={set("term")}>{[1, 2, 3].map(t => <option key={t}>{t}</option>)}</Select></Field>
    <Field label="Out of"><input className="input" type="number" min={1} value={f.max_marks} onChange={e => set("max_marks")(e.target.value)} /></Field>
    <div className="sm:col-span-3 flex items-center gap-3"><button className="btn-primary" onClick={create} disabled={!f.class_id || !f.subject_id || !f.title}>Create assessment</button><ErrorNote msg={err} /></div></div>);
}

export default function MarkEntry() {
  const [sp, setSp] = useSearchParams(); const aid = sp.get("a"); const toast = useToast();
  const list = useFetch("/assessments"); const [showNew, setShowNew] = useState(false);
  const sheetQ = useFetch(aid ? `/assessments/${aid}/sheet` : null);
  const [rows, setRows] = useState<Row[]>([]); const [dirty, setDirty] = useState(false); const [status, setStatus] = useState(""); const [errs, setErrs] = useState<Record<string, string>>({});
  const [reason, setReason] = useState(""); const [busy, setBusy] = useState(false); const inputs = useRef<(HTMLInputElement | null)[]>([]);
  const a = sheetQ.data?.assessment; const max = a?.max_marks ?? 0; const level = a?.level ?? "O";

  useEffect(() => { if (!sheetQ.data || !aid) return; const draft = localStorage.getItem(`draft:${aid}`);
    let r: Row[] = sheetQ.data.rows; if (draft) { try { const d: Row[] = JSON.parse(draft); r = r.map(x => d.find(y => y.student_id === x.student_id) ?? x); setDirty(true); toast.show("Restored unsaved marks from this device."); } catch {} }
    setRows(r); setErrs({}); }, [sheetQ.data, aid]);

  const needReason = useMemo(() => Object.values(errs).some(e => e.includes("reason")), [errs]);
  function edit(i: number, v: string) { const n = v === "" ? null : Math.min(Math.max(Number(v), 0), max);
    setRows(rs => { const c = rs.map((r, j) => j === i ? { ...r, marks_obtained: n, absent: false } : r); localStorage.setItem(`draft:${aid}`, JSON.stringify(c)); return c; }); setDirty(true); }
  function toggleAbs(i: number) { setRows(rs => rs.map((r, j) => j === i ? { ...r, absent: !r.absent, marks_obtained: null } : r)); setDirty(true); }
  function paste(e: React.ClipboardEvent, i: number) {   // paste a column straight from Excel
    const lines = e.clipboardData.getData("text").split(/\r?\n/).map(s => s.trim()).filter(Boolean); if (lines.length < 2) return; e.preventDefault();
    setRows(rs => { const c = [...rs]; lines.forEach((t, k) => { if (c[i + k]) { const n = Number(t.replace(",", ".")); if (!Number.isNaN(n)) c[i + k] = { ...c[i + k], marks_obtained: Math.min(Math.max(n, 0), max), absent: false }; else if (/^a(bs)?$/i.test(t)) c[i + k] = { ...c[i + k], absent: true, marks_obtained: null }; } }); localStorage.setItem(`draft:${aid}`, JSON.stringify(c)); return c; }); setDirty(true); }

  async function save() {
    if (!aid || busy) return; setBusy(true);
    try {
      const r = await api(`/assessments/${aid}/marks`, { method: "PUT", json: { marks: rows.map(x => ({ student_id: x.student_id, marks_obtained: x.marks_obtained, absent: x.absent, reason: reason || null })) } });
      const e: Record<string, string> = {}; r.errors.forEach((x: any) => (e[x.student_id] = x.error)); setErrs(e);
      if (!r.errors.length) { localStorage.removeItem(`draft:${aid}`); setDirty(false); setReason(""); list.reload(); }
      setStatus(r.errors.length ? "problems" : "saved");
    } catch (x) { setStatus(/offline|fetch|network/i.test((x as Error).message) ? "offline" : "error:" + (x as Error).message); } finally { setBusy(false); }
  }
  const saveRef = useRef(save); saveRef.current = save;
  useEffect(() => { const t = setInterval(() => { if (dirty && navigator.onLine && !needReason) saveRef.current(); }, 30_000); return () => clearInterval(t); }, [dirty, needReason]);

  async function bulk(file: File) { const fd = new FormData(); fd.append("file", file); try { const r = await upload(`/assessments/${aid}/marks/upload${reason ? `?reason=${encodeURIComponent(reason)}` : ""}`, fd);
    toast.show(`${r.saved} marks imported${r.errors.length ? `, ${r.errors.length} rows skipped: ${r.errors[0].error}` : ""}`); localStorage.removeItem(`draft:${aid}`); setDirty(false); sheetQ.reload(); list.reload(); } catch (e) { toast.show((e as Error).message); } }

  if (!aid) return (<div className="mx-auto max-w-4xl"><PageHeader eyebrow="Mark entry" title="Choose an assessment" sub="Marks save automatically, even when the power drops."><button className="btn-primary" onClick={() => setShowNew(s => !s)}><Plus size={16} />New assessment</button></PageHeader>
    {showNew && <NewAssessment onDone={() => { setShowNew(false); list.reload(); }} />}
    {list.loading ? <Spinner /> : !(list.data ?? []).length ? <Empty title="No assessments yet" hint="Create your first test or exam to start entering marks." /> :
      <div className="grid gap-3 sm:grid-cols-2">{list.data.map((x: any) => <button key={x.id} onClick={() => setSp({ a: x.id })} className="card p-4 text-left transition hover:shadow-lg">
        <div className="flex justify-between gap-2"><p className="font-medium">{x.subject} · {x.class}</p><Badge tone={x.entered === x.total ? "green" : "amber"}>{x.entered}/{x.total}</Badge></div>
        <p className="text-sm text-mute">{x.title} · Term {x.term} {x.year} · out of {x.max_marks}</p></button>)}</div>}{toast.node}</div>);

  if (sheetQ.loading) return <Spinner />; if (sheetQ.error) return <ErrorNote msg={sheetQ.error} />;
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader eyebrow="Mark entry" title={a.title} sub={`Out of ${max} · ${level === "A" ? "A-Level" : "O-Level"} grading${a.locked ? " · Locked" : ""}`}>
        <button className="btn-ghost" onClick={() => { setSp({}); setDirty(false); }}>All assessments</button>
        <label className="btn-ghost cursor-pointer"><Upload size={16} />Import Excel/CSV<input type="file" hidden accept=".xlsx,.csv" onChange={e => e.target.files?.[0] && bulk(e.target.files[0])} /></label>
        <button className="btn-primary" onClick={save} disabled={!dirty || busy}>{busy ? "Saving…" : "Save marks"}</button></PageHeader>
      <div className="mb-3 flex min-h-6 items-center gap-2 text-sm">
        {status === "saved" && !dirty && <span className="flex items-center gap-1 text-emerald-700"><CheckCircle2 size={16} />All marks saved</span>}
        {status === "offline" && <span className="flex items-center gap-1 text-amber-700"><CloudOff size={16} />No connection. Marks are safe on this device and will save when you reconnect.</span>}
        {status.startsWith("error:") && <ErrorNote msg={status.slice(6)} />}{status === "problems" && <span className="text-red-700">Some rows need attention (marked below).</span>}</div>
      {needReason && <div className="card mb-4 border-gold-500 p-4"><Field label="Reason for changing saved marks (kept in the audit record)"><input className="input" value={reason} onChange={e => setReason(e.target.value)} placeholder="e.g. Addition error found on marking" /></Field>
        <button className="btn-primary mt-3" disabled={!reason.trim()} onClick={save}>Save with reason</button></div>}
      {!rows.length ? <Empty title="No students in this class" /> : <div className="card overflow-hidden"><table className="w-full text-sm">
        <thead className="bg-navy-50 text-left text-xs uppercase tracking-wide text-mute"><tr><th className="px-4 py-3">Student</th><th className="w-32 px-4 py-3">Mark</th><th className="w-14 px-2 py-3 text-center">Abs</th><th className="w-16 px-4 py-3 text-center">Grade</th></tr></thead>
        <tbody>{rows.map((r, i) => { const g = r.marks_obtained == null ? "" : gradeFor(r.marks_obtained, max, level); const e = errs[r.student_id];
          return (<tr key={r.student_id} className={`border-t border-line ${e ? "bg-red-50" : ""}`}>
            <td className="px-4 py-2"><div className="font-medium">{r.name}</div><div className="text-xs text-mute">{e ?? r.admission_no}</div></td>
            <td className="px-4 py-2"><input ref={el => (inputs.current[i] = el)} aria-label={`Mark for ${r.name}`} type="number" inputMode="decimal" min={0} max={max} step="0.5" disabled={r.absent || a.locked} className="input py-2 disabled:bg-paper"
              value={r.marks_obtained ?? ""} onChange={ev => edit(i, ev.target.value)} onPaste={ev => paste(ev, i)} onKeyDown={ev => { if (ev.key === "Enter") { ev.preventDefault(); inputs.current[i + 1]?.focus(); } }} /></td>
            <td className="px-2 py-2 text-center"><input type="checkbox" aria-label={`${r.name} absent`} checked={r.absent} onChange={() => toggleAbs(i)} className="h-5 w-5 accent-navy-700" /></td>
            <td className={`px-4 py-2 text-center text-base font-semibold ${gradeTone(g)}`}>{r.absent ? "ABS" : g || "–"}</td></tr>); })}</tbody></table></div>}
      <p className="mt-3 text-xs text-mute">Tip: press Enter to move down, or paste a whole column from Excel. Auto-saves every 30 seconds.</p>{toast.node}
    </div>
  );
}
