import { useState } from "react";
import { CalendarPlus, Download, Trash2 } from "lucide-react";
import { api, openFile, session } from "../lib/api";
import { useFetch } from "../lib/hooks";
import { Badge, Empty, ErrorNote, Field, PageHeader, Select, Spinner, useToast } from "../components/ui";

const KIND: Record<string, [string, "navy" | "green" | "amber" | "red" | "gold"]> = { term: ["Term", "green"], holiday: ["Holiday", "gold"], exam: ["Exam", "red"], sports: ["Sports", "amber"], event: ["Event", "navy"] };
const fmt = (iso: string) => new Date(iso + "T00:00").toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short" });

export default function Calendar() {
  const admin = session.role() === "admin"; const today = new Date(); const start = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
  const end = new Date(today.getFullYear(), today.getMonth() + 7, 0).toISOString().slice(0, 10); const q = useFetch(`/calendar?start=${start}&end=${end}`); const toast = useToast();
  const [show, setShow] = useState(false); const [f, setF] = useState<any>({ kind: "event" }); const [err, setErr] = useState("");
  const set = (k: string) => (v: string) => setF((s: any) => ({ ...s, [k]: v }));
  async function add() { setErr(""); try { await api("/calendar", { method: "POST", json: { title: f.title, kind: f.kind, start_date: f.start, end_date: f.end || null, form: f.form ? +f.form : null, description: f.description || null } }); setShow(false); setF({ kind: "event" }); q.reload(); } catch (e) { setErr((e as Error).message); } }
  const groups: Record<string, any[]> = {}; (q.data ?? []).forEach((e: any) => { const m = new Date(e.start_date + "T00:00").toLocaleDateString("en-GB", { month: "long", year: "numeric" }); (groups[m] ||= []).push(e); });
  return (
    <div className="mx-auto max-w-3xl"><PageHeader eyebrow="School year" title="Calendar" sub="Terms, exams, sports and events.">
      <button className="btn-ghost border border-line" onClick={() => openFile("/calendar/ics", { save: "st-eric.ics" }).catch(e => toast.show(e.message))}><Download size={16} />Add to phone calendar</button>
      {admin && <button className="btn-primary" onClick={() => setShow(s => !s)}><CalendarPlus size={16} />Add event</button>}</PageHeader>
      {admin && show && <div className="card mb-6 grid gap-3 p-5 sm:grid-cols-2"><div className="sm:col-span-2"><Field label="Title"><input className="input" value={f.title ?? ""} onChange={e => set("title")(e.target.value)} /></Field></div>
        <Field label="Type"><Select value={f.kind} onChange={set("kind")}>{Object.entries(KIND).map(([k, [l]]) => <option key={k} value={k}>{l}</option>)}</Select></Field>
        <Field label="Only for"><Select value={f.form} onChange={set("form")}><option value="">Whole school</option>{[1, 2, 3, 4, 5, 6].map(n => <option key={n} value={n}>Form {n}</option>)}</Select></Field>
        <Field label="Starts"><input type="date" className="input" value={f.start ?? ""} onChange={e => set("start")(e.target.value)} /></Field><Field label="Ends (optional)"><input type="date" className="input" value={f.end ?? ""} onChange={e => set("end")(e.target.value)} /></Field>
        <div className="sm:col-span-2"><Field label="Details (optional)"><input className="input" value={f.description ?? ""} onChange={e => set("description")(e.target.value)} /></Field></div>
        <div className="sm:col-span-2 flex items-center gap-3"><button className="btn-primary" disabled={!f.title || !f.start} onClick={add}>Save event</button><ErrorNote msg={err} /></div></div>}
      {q.loading ? <Spinner /> : q.error ? <ErrorNote msg={q.error} /> : !q.data.length ? <Empty title="Nothing scheduled" hint="Events will appear here once the school adds them." /> :
        Object.entries(groups).map(([m, list]) => <section key={m} className="mb-6"><h2 className="mb-2 font-display text-lg text-navy-800">{m}</h2><div className="card divide-y divide-line">{list.map(e => (
          <div key={e.id} className="flex items-start gap-4 p-4"><div className="w-28 shrink-0 text-sm font-medium text-navy-700">{fmt(e.start_date)}{e.end_date && e.end_date !== e.start_date && <span className="block text-xs text-mute">to {fmt(e.end_date)}</span>}</div>
            <div className="min-w-0 flex-1"><p className="font-medium">{e.title}</p>{e.description && <p className="text-sm text-mute">{e.description}</p>}{e.form && <p className="text-xs text-mute">Form {e.form} only</p>}</div>
            <Badge tone={KIND[e.kind][1]}>{KIND[e.kind][0]}</Badge>{admin && <button aria-label="Delete event" className="p-1 text-red-700" onClick={() => confirm("Delete this event?") && api(`/calendar/${e.id}`, { method: "DELETE" }).then(q.reload)}><Trash2 size={16} /></button>}</div>))}</div></section>)}{toast.node}</div>
  );
}
