import { useState } from "react";
import { api, openFile } from "../lib/api";
import { useFetch } from "../lib/hooks";
import { fmtDate } from "../lib/zim";
import { Badge, Empty, ErrorNote, PageHeader, Select, Spinner, useToast } from "../components/ui";

const TONE: any = { received: "gold", under_review: "navy", accepted: "green", waitlisted: "amber", declined: "red" };

export default function Applications() {
  const [status, setStatus] = useState(""); const q = useFetch(`/applications${status ? `?status=${status}` : ""}`); const classes = useFetch("/classes"); const toast = useToast();
  const [open, setOpen] = useState(""); const [cls, setCls] = useState(""); const [notes, setNotes] = useState(""); const [res, setRes] = useState<any>(null); const [err, setErr] = useState("");
  const act = async (p: Promise<any>) => { setErr(""); try { const r = await p; q.reload(); return r; } catch (e) { setErr((e as Error).message); } };
  return (
    <div className="mx-auto max-w-4xl page-enter"><PageHeader eyebrow="Admissions" title="Applications"><div className="w-44"><Select value={status} onChange={setStatus}><option value="">All</option>{Object.keys(TONE).map(s => <option key={s} value={s}>{s.replace("_", " ")}</option>)}</Select></div></PageHeader>
      <p className="mb-4 text-sm text-mute">Share this link for applications: <b className="select-all">{location.origin}/apply</b></p>
      {q.loading ? <Spinner /> : q.error ? <ErrorNote msg={q.error} /> : !q.data.length ? <Empty title="No applications" /> : <div className="space-y-3">{q.data.map((a: any) => (
        <div key={a.id} className="card p-4"><button className="flex w-full flex-wrap items-center justify-between gap-2 text-left" onClick={() => { setOpen(open === a.id ? "" : a.id); setRes(null); setErr(""); setNotes(a.notes ?? ""); }}>
          <div><p className="font-medium">{a.name}</p><p className="text-xs text-mute">{a.reference} · Form {a.intake_form} · {fmtDate(a.created_at)}</p></div><Badge tone={TONE[a.status]}>{a.status.replace("_", " ")}</Badge></button>
          {open === a.id && <div className="mt-4 space-y-3 border-t border-line pt-4 text-sm">
            <div className="grid gap-1 sm:grid-cols-2"><p><b>Born:</b> {fmtDate(a.date_of_birth)} ({a.gender ?? "–"})</p><p><b>Previous school:</b> {a.previous_school ?? "–"}</p><p><b>Guardian:</b> {a.guardian_name}</p><p><b>Phone:</b> {a.guardian_phone}</p>{a.subjects_interest && <p className="sm:col-span-2"><b>Subjects:</b> {a.subjects_interest}</p>}</div>
            <div className="flex gap-2">{a.has_birth_cert && <button className="btn-ghost border border-line !py-1.5" onClick={() => openFile(`/applications/${a.id}/file/birth_cert`)}>Birth certificate</button>}{a.has_report && <button className="btn-ghost border border-line !py-1.5" onClick={() => openFile(`/applications/${a.id}/file/report`)}>Last report</button>}</div>
            {a.status !== "accepted" && <><input className="input" placeholder="Internal notes (not shown to the family)" value={notes} onChange={e => setNotes(e.target.value)} />
              <div className="flex flex-wrap gap-2">{["under_review", "waitlisted", "declined"].map(s => <button key={s} className="btn-ghost border border-line" onClick={() => act(api(`/applications/${a.id}`, { method: "PATCH", json: { status: s, notes } }))}>Mark {s.replace("_", " ")}</button>)}</div>
              <div className="flex flex-wrap items-end gap-2 rounded-lg bg-navy-50 p-3"><div className="w-56"><Select value={cls} onChange={setCls}><option value="">Accept into class…</option>{(classes.data ?? []).filter((c: any) => c.form === a.intake_form).map((c: any) => <option key={c.id} value={c.id}>{c.name} ({c.year})</option>)}</Select></div>
                <button className="btn-primary" disabled={!cls} onClick={async () => { const r = await act(api(`/applications/${a.id}/accept`, { method: "POST", json: { class_id: cls } })); if (r) setRes(r); }}>Accept and enrol</button></div></>}
            {res && <div className="rounded-lg bg-emerald-50 p-3 text-emerald-900">Enrolled as <b>{res.admission_no}</b>. Parent username <b>{res.parent_username}</b>{res.temporary_password ? <>, temporary password <b className="select-all font-mono">{res.temporary_password}</b> (shown once)</> : " (existing account linked)"}.</div>}
            <ErrorNote msg={err} /></div>}</div>))}</div>}{toast.node}</div>
  );
}
