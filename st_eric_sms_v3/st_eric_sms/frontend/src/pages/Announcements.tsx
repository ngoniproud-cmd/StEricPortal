import { useState } from "react";
import { api, session } from "../lib/api";
import { useFetch } from "../lib/hooks";
import { fmtDate } from "../lib/zim";
import { Badge, Empty, ErrorNote, Field, PageHeader, Select, Spinner } from "../components/ui";

export default function Announcements() {
  const role = session.role(); const canPost = role === "admin" || role === "teacher"; const q = useFetch("/announcements");
  const [f, setF] = useState({ title: "", body: "", audience: role === "admin" ? "all" : "students" }); const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  async function post() { setBusy(true); setErr(""); try { await api("/announcements", { method: "POST", json: f }); setF({ ...f, title: "", body: "" }); q.reload(); } catch (e) { setErr((e as Error).message); } finally { setBusy(false); } }
  return (
    <div className="mx-auto max-w-3xl"><PageHeader eyebrow="School news" title="Announcements" sub="Messages from the school. These are one-way notices." />
      {canPost && <div className="card mb-6 space-y-3 p-5"><Field label="Title"><input className="input" value={f.title} onChange={e => setF({ ...f, title: e.target.value })} /></Field>
        <Field label="Message"><textarea className="input min-h-24" value={f.body} onChange={e => setF({ ...f, body: e.target.value })} /></Field>
        <div className="flex flex-wrap items-end gap-3"><div className="w-48"><Field label="Send to"><Select value={f.audience} onChange={v => setF({ ...f, audience: v })}>{role === "admin" && <option value="all">Everyone</option>}<option value="students">Students</option><option value="parents">Parents</option>{role === "admin" && <option value="teachers">Teachers</option>}</Select></Field></div>
          <button className="btn-primary" onClick={post} disabled={busy || f.title.length < 3 || f.body.length < 3}>Post announcement</button></div><ErrorNote msg={err} /></div>}
      {q.loading ? <Spinner /> : !(q.data ?? []).length ? <Empty title="No announcements yet" /> : <div className="space-y-3">{q.data.map((a: any) => <article key={a.id} className="card p-5">
        <div className="flex items-start justify-between gap-3"><h2 className="font-display text-lg text-navy-800">{a.title}</h2><Badge tone="gold">{a.audience}</Badge></div>
        <p className="mt-2 whitespace-pre-line text-sm leading-relaxed">{a.body}</p><p className="mt-3 text-xs text-mute">{a.by} · {fmtDate(a.created_at)}</p></article>)}</div>}
    </div>
  );
}
