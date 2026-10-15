import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Check, Download, Eye, FileText, Heart, Search, Trash2, Upload, X } from "lucide-react";
import { api, openFile, session, upload } from "../lib/api";
import { useFetch } from "../lib/hooks";
import { KINDS, currentYear, fmtSize } from "../lib/zim";
import { Badge, Empty, ErrorNote, Field, PageHeader, Select, Spinner, useToast } from "../components/ui";

function Card({ it, toast, reload, mode }: { it: any; toast: (m: string) => void; reload: () => void; mode: "browse" | "mine" | "review" }) {
  const [rej, setRej] = useState(false); const [why, setWhy] = useState(""); const role = session.role();
  const run = (p: Promise<any>, ok?: string) => p.then(() => { if (ok) toast(ok); reload(); }).catch(e => toast(e.message));
  return (
    <div className="card flex flex-col p-4"><div className="flex items-start gap-3"><div className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-navy-50 text-navy-600"><FileText size={22} /></div>
      <div className="min-w-0 flex-1"><p className="font-medium leading-snug">{it.title}</p><p className="mt-0.5 text-xs text-mute">{[it.subject, it.form ? `Form ${it.form}` : "All forms", it.exam_year && `${it.session ?? ""} ${it.exam_year}`.trim(), it.paper_no && `Paper ${it.paper_no}`].filter(Boolean).join(" · ")}</p></div>
      {mode === "browse" && role !== "parent" && <button aria-label="Favourite" aria-pressed={it.favourite} className="p-1" onClick={() => run(api(`/library/${it.id}/favourite`, { method: "POST" }))}><Heart size={18} className={it.favourite ? "fill-gold-500 text-gold-500" : "text-mute"} /></button>}</div>
      {it.description && <p className="mt-2 line-clamp-2 text-sm text-mute">{it.description}</p>}
      <div className="mt-3 flex flex-wrap items-center gap-2"><Badge tone="navy">{KINDS[it.kind]}</Badge><span className="text-xs text-mute">{fmtSize(it.size_bytes)}</span>
        {mode !== "review" && <span className="ml-auto flex items-center gap-2 text-xs text-mute"><Eye size={13} />{it.views}<Download size={13} />{it.downloads}</span>}
        {mode === "mine" && <Badge tone={it.status === "approved" ? "green" : it.status === "rejected" ? "red" : "amber"}>{it.status === "pending" ? "Waiting for librarian" : it.status}</Badge>}</div>
      {it.reject_reason && mode === "mine" && <p className="mt-2 rounded bg-red-50 p-2 text-xs text-red-700">Not approved: {it.reject_reason}</p>}
      {mode === "review" && <p className="mt-2 text-xs text-mute">Uploaded by {it.uploaded_by}</p>}
      <div className="mt-4 flex flex-wrap gap-2">
        <button className="btn-primary !px-3 !py-2" onClick={() => openFile(`/library/${it.id}/view`).catch(e => toast(e.message))}>{mode === "review" ? "Preview" : "Read"}</button>
        {mode !== "review" && <button className="btn-ghost border border-line !px-3 !py-2" onClick={() => openFile(`/library/${it.id}/download`, { save: it.file_name }).catch(e => toast(e.message))}>Download</button>}
        {mode === "review" && !rej && <><button className="btn-ghost border border-emerald-200 !px-3 !py-2 text-emerald-700" onClick={() => run(api(`/library/${it.id}/review`, { method: "POST", json: { approve: true } }), "Approved and published.")}><Check size={16} />Approve</button>
          <button className="btn-ghost border border-red-200 !px-3 !py-2 text-red-700" onClick={() => setRej(true)}><X size={16} />Reject</button></>}
        {mode === "mine" && <button aria-label="Remove" className="btn-ghost ml-auto !p-2 text-red-700" onClick={() => confirm("Remove this upload?") && run(api(`/library/${it.id}`, { method: "DELETE" }), "Removed.")}><Trash2 size={16} /></button>}
        {mode === "browse" && role === "admin" && <button aria-label="Remove" className="btn-ghost ml-auto !p-2 text-red-700" onClick={() => confirm("Remove from the library?") && run(api(`/library/${it.id}`, { method: "DELETE" }), "Removed.")}><Trash2 size={16} /></button>}</div>
      {rej && <div className="mt-3 space-y-2"><input autoFocus className="input" placeholder="Tell the teacher why (required)" value={why} onChange={e => setWhy(e.target.value)} />
        <div className="flex gap-2"><button className="btn-primary !px-3 !py-2" disabled={!why.trim()} onClick={() => run(api(`/library/${it.id}/review`, { method: "POST", json: { approve: false, reason: why } }), "Sent back to the teacher.")}>Send rejection</button><button className="btn-ghost !px-3 !py-2" onClick={() => setRej(false)}>Cancel</button></div></div>}
    </div>
  );
}

function UploadForm({ onDone, toast }: { onDone: () => void; toast: (m: string) => void }) {
  const subjects = useFetch("/subjects"); const [f, setF] = useState<any>({ kind: "notes", form: "0", title: "" }); const [file, setFile] = useState<File | null>(null); const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  const set = (k: string) => (v: string) => setF((s: any) => ({ ...s, [k]: v })); const paper = f.kind === "past_paper" || f.kind === "marking_scheme";
  async function submit() { if (!file) return; setBusy(true); setErr(""); const fd = new FormData(); Object.entries(f).forEach(([k, v]) => v !== undefined && v !== "" && fd.append(k, String(v))); fd.append("file", file);
    try { const r = await upload("/library", fd); toast(r.status === "approved" ? "Published to the library." : "Sent to the librarian for approval."); onDone(); } catch (e) { setErr((e as Error).message); } finally { setBusy(false); } }
  return (<div className="card mb-6 grid gap-3 p-5 sm:grid-cols-2">
    <div className="sm:col-span-2"><Field label="Title"><input className="input" value={f.title} onChange={e => set("title")(e.target.value)} placeholder="e.g. Physics Paper 2, November 2024" /></Field></div>
    <Field label="Type"><Select value={f.kind} onChange={set("kind")}>{Object.entries(KINDS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></Field>
    <Field label="Subject"><Select value={f.subject_id} onChange={set("subject_id")}><option value="">Not subject-specific</option>{(subjects.data ?? []).map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select></Field>
    <Field label="Form"><Select value={f.form} onChange={set("form")}><option value="0">All forms</option>{[1, 2, 3, 4, 5, 6].map(n => <option key={n} value={n}>Form {n}</option>)}</Select></Field>
    {paper && <><Field label="Exam year"><input className="input" type="number" min={1990} max={currentYear()} value={f.exam_year ?? ""} onChange={e => set("exam_year")(e.target.value)} /></Field>
      <Field label="Session"><Select value={f.session} onChange={set("session")}><option value="">–</option><option>June</option><option>November</option></Select></Field>
      <Field label="Paper number"><input className="input" value={f.paper_no ?? ""} onChange={e => set("paper_no")(e.target.value)} placeholder="1, 2, 3…" /></Field></>}
    <div className="sm:col-span-2"><Field label="Description (optional)"><input className="input" value={f.description ?? ""} onChange={e => set("description")(e.target.value)} /></Field></div>
    <div className="sm:col-span-2"><label className="btn-ghost cursor-pointer border border-dashed border-navy-300"><Upload size={16} />{file ? `${file.name} (${fmtSize(file.size)})` : "Choose file (PDF, Word, PowerPoint, Excel or image, up to 50 MB)"}<input hidden type="file" accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.png,.jpg,.jpeg" onChange={e => setFile(e.target.files?.[0] ?? null)} /></label></div>
    <div className="sm:col-span-2 flex items-center gap-3"><button className="btn-primary" onClick={submit} disabled={busy || !file || f.title.trim().length < 2}>{busy ? "Uploading…" : "Upload"}</button><ErrorNote msg={err} /></div></div>);
}

export default function Library() {
  const role = session.role(); const canUpload = ["teacher", "librarian", "admin"].includes(role); const canReview = role === "librarian" || role === "admin";
  const [sp, setSp] = useSearchParams(); const tab = sp.get("tab") ?? "browse"; const toast = useToast(); const [showUp, setShowUp] = useState(false);
  const [q, setQ] = useState(""); const [kind, setKind] = useState(""); const [subject, setSubject] = useState(""); const [form, setForm] = useState(""); const [sort, setSort] = useState("new"); const [favs, setFavs] = useState(false);
  const subjects = useFetch("/subjects");
  const params = new URLSearchParams(); if (q) params.set("q", q); if (kind) params.set("kind", kind); if (subject) params.set("subject_id", subject); if (form) params.set("form", form); if (favs) params.set("favourites", "true"); params.set("sort", sort);
  const path = tab === "mine" ? "/library/mine" : tab === "review" ? "/library/pending" : `/library?${params}`;
  const data = useFetch(path); const tabs = [["browse", "Browse"], ...(canUpload ? [["mine", "My uploads"]] : []), ...(canReview ? [["review", "Review"]] : [])];
  return (
    <div className="mx-auto max-w-6xl"><PageHeader eyebrow="Learning resources" title="School library" sub="Textbooks, notes and past exam papers, available anytime.">{canUpload && <button className="btn-primary" onClick={() => setShowUp(s => !s)}><Upload size={16} />Add material</button>}</PageHeader>
      {showUp && <UploadForm toast={toast.show} onDone={() => { setShowUp(false); data.reload(); }} />}
      <div className="mb-5 flex gap-1 border-b border-line">{tabs.map(([k, l]) => <button key={k} onClick={() => setSp(k === "browse" ? {} : { tab: k })} className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-medium ${tab === k ? "border-gold-500 text-navy-800" : "border-transparent text-mute hover:text-ink"}`}>{l}</button>)}</div>
      {tab === "browse" && <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        <div className="relative lg:col-span-2"><Search size={16} className="absolute left-3 top-3.5 text-mute" /><input className="input pl-9" placeholder="Search title or topic" value={q} onChange={e => setQ(e.target.value)} /></div>
        <Select aria-label="Type" value={kind} onChange={setKind}><option value="">All types</option>{Object.entries(KINDS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select>
        <Select aria-label="Subject" value={subject} onChange={setSubject}><option value="">All subjects</option>{(subjects.data ?? []).map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select>
        <Select aria-label="Form" value={form} onChange={setForm}><option value="">All forms</option>{[1, 2, 3, 4, 5, 6].map(n => <option key={n} value={n}>Form {n}</option>)}</Select>
        <Select aria-label="Sort" value={sort} onChange={setSort}><option value="new">Newest</option><option value="popular">Most read</option><option value="title">A to Z</option></Select>
        {role !== "parent" && <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4 accent-navy-700" checked={favs} onChange={e => setFavs(e.target.checked)} />Favourites only</label>}</div>}
      {data.loading ? <Spinner /> : data.error ? <ErrorNote msg={data.error} /> : !(data.data ?? []).length ? <Empty title={tab === "review" ? "Nothing waiting for review" : "Nothing here yet"} hint={tab === "browse" ? "Try different filters, or check back soon." : undefined} /> :
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{data.data.map((it: any) => <Card key={it.id} it={it} mode={tab as any} toast={toast.show} reload={data.reload} />)}</div>}{toast.node}
    </div>
  );
}
