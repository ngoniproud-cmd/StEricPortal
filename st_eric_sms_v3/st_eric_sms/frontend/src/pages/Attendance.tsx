import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { useFetch } from "../lib/hooks";
import { Empty, ErrorNote, Field, PageHeader, Select, Spinner, useToast } from "../components/ui";

const OPTS = [["present", "P", "bg-emerald-600"], ["absent", "A", "bg-red-600"], ["late", "L", "bg-amber-500"], ["excused", "E", "bg-navy-500"]] as const;

export default function Attendance() {
  const classes = useFetch("/classes"); const [cid, setCid] = useState(""); const [day, setDay] = useState(new Date().toISOString().slice(0, 10)); const toast = useToast();
  const reg = useFetch(cid ? `/attendance/class/${cid}?day=${day}` : null); const [rows, setRows] = useState<any[]>([]); const [busy, setBusy] = useState(false);
  useEffect(() => { if (reg.data) setRows(reg.data.rows); }, [reg.data]);
  const count = (s: string) => rows.filter(r => r.status === s).length;
  async function save() { setBusy(true); try { const r = await api(`/attendance/class/${cid}?day=${day}`, { method: "PUT", json: rows.map(x => ({ student_id: x.student_id, status: x.status })) });
    toast.show(`Register saved.${r.absent ? ` ${r.absent} parent${r.absent > 1 ? "s" : ""} alerted.` : ""}`); reg.reload(); } catch (e) { toast.show((e as Error).message); } finally { setBusy(false); } }
  return (
    <div className="mx-auto max-w-2xl"><PageHeader eyebrow="Register" title="Attendance" sub="Everyone starts as Present. Tap to change."><button className="btn-primary" onClick={save} disabled={!rows.length || busy}>{busy ? "Saving…" : "Save register"}</button></PageHeader>
      <div className="card mb-5 grid gap-3 p-4 sm:grid-cols-2"><Field label="Class"><Select value={cid} onChange={setCid}><option value="">Choose…</option>{(classes.data ?? []).map((c: any) => <option key={c.id} value={c.id}>{c.name} ({c.year})</option>)}</Select></Field>
        <Field label="Date"><input type="date" className="input" value={day} max={new Date().toISOString().slice(0, 10)} onChange={e => setDay(e.target.value)} /></Field></div>
      {reg.loading ? <Spinner /> : reg.error ? <ErrorNote msg={reg.error} /> : !cid ? <Empty title="Choose a class" /> : !rows.length ? <Empty title="No students in this class" /> : <>
        <div className="mb-3 flex flex-wrap gap-2 text-sm">{OPTS.map(([k, , c]) => <span key={k} className="flex items-center gap-1.5 rounded-full bg-white px-3 py-1 shadow-card"><i className={`h-2.5 w-2.5 rounded-full ${c}`} />{count(k)} {k}</span>)}{reg.data?.already_marked && <span className="rounded-full bg-gold-100 px-3 py-1 text-gold-600">Already marked today. Changes will update it.</span>}</div>
        <div className="card divide-y divide-line">{rows.map((r, i) => <div key={r.student_id} className="flex items-center justify-between gap-3 px-4 py-3"><div className="min-w-0"><p className="truncate font-medium">{r.name}</p><p className="text-xs text-mute">{r.admission_no}</p></div>
          <div className="flex gap-1.5" role="group" aria-label={`Attendance for ${r.name}`}>{OPTS.map(([k, l, c]) => <button key={k} aria-pressed={r.status === k} aria-label={k} onClick={() => setRows(rs => rs.map((x, j) => j === i ? { ...x, status: k } : x))} className={`h-11 w-11 rounded-lg text-sm font-semibold transition ${r.status === k ? `${c} text-white shadow` : "bg-paper text-mute hover:bg-navy-50"}`}>{l}</button>)}</div></div>)}</div></>}{toast.node}</div>
  );
}
