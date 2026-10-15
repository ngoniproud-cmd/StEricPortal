import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Check, Download, FileText, Heart, Search, Trash2, Upload, X } from "lucide-react";
import { api, openFile, session, upload } from "../lib/api";
import { useFetch } from "../lib/hooks";
import { KINDS, currentYear, fmtSize } from "../lib/zim";
import { Badge, Empty, ErrorNote, Field, PageHeader, Select, Spinner, useToast } from "../components/ui";

function Card({ it, toast, reload, mode }: { it: any; toast: (m: string) => void; reload: () => void; mode: "browse" | "mine" | "review" }) {
  const [rej, setRej] = useState(false);
  const [why, setWhy] = useState("");
  const role = session.role();
  const run = (p: Promise<any>, ok?: string) => p.then(() => { if (ok) toast(ok); reload(); }).catch(e => toast(e.message));

  const meta = [it.subject, it.form ? `Form ${it.form}` : null, it.exam_year && `${it.session ?? ""} ${it.exam_year}`.trim(), it.paper_no && `Paper ${it.paper_no}`].filter(Boolean).join(" · ");

  return (
    <div className="card-static flex flex-col p-4">
      <div className="flex items-start gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-navy-50 text-navy-600">
          <FileText size={20} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-sm text-navy-900 leading-snug">{it.title}</p>
          {meta && <p className="mt-0.5 text-xs text-slate-500">{meta}</p>}
        </div>
        {mode === "browse" && role !== "parent" && (
          <button aria-label="Favourite" aria-pressed={it.favourite} className="p-1 shrink-0" onClick={() => run(api(`/library/${it.id}/favourite`, { method: "POST" }))}>
            <Heart size={16} className={it.favourite ? "fill-crimson-600 text-crimson-600" : "text-slate-400"} />
          </button>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Badge tone="navy">{KINDS[it.kind]}</Badge>
        <span className="text-xs text-slate-400">{fmtSize(it.size_bytes)}</span>
        {mode === "mine" && (
          <Badge tone={it.status === "approved" ? "green" : it.status === "rejected" ? "red" : "amber"}>
            {it.status === "pending" ? "Pending review" : it.status}
          </Badge>
        )}
      </div>

      {it.reject_reason && mode === "mine" && (
        <p className="mt-2 rounded-lg bg-red-50 p-2 text-xs text-red-700 border border-red-100">{it.reject_reason}</p>
      )}

      {mode === "review" && (
        <p className="mt-2 text-xs text-slate-500">By {it.uploaded_by}</p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button className="btn-primary !px-3 !py-1.5 text-xs" onClick={() => openFile(`/library/${it.id}/view`).catch(e => toast(e.message))}>
          {mode === "review" ? "Preview" : "Read"}
        </button>
        {mode !== "review" && (
          <button className="btn-outline !px-3 !py-1.5 text-xs" onClick={() => openFile(`/library/${it.id}/download`, { save: it.file_name }).catch(e => toast(e.message))}>
            <Download size={13} /> Download
          </button>
        )}
        {mode === "review" && !rej && (
          <>
            <button className="btn-outline !px-3 !py-1.5 text-xs text-emerald-700 border-emerald-200" onClick={() => run(api(`/library/${it.id}/review`, { method: "POST", json: { approve: true } }), "Approved.")}>
              <Check size={14} /> Approve
            </button>
            <button className="btn-outline !px-3 !py-1.5 text-xs text-red-700 border-red-200" onClick={() => setRej(true)}>
              <X size={14} /> Reject
            </button>
          </>
        )}
        {(mode === "mine" || (mode === "browse" && role === "admin")) && (
          <button aria-label="Remove" className="btn-ghost ml-auto !p-1.5 text-red-600" onClick={() => confirm("Remove?") && run(api(`/library/${it.id}`, { method: "DELETE" }), "Removed.")}>
            <Trash2 size={14} />
          </button>
        )}
      </div>

      {rej && (
        <div className="mt-3 space-y-2">
          <input autoFocus className="input" placeholder="Reason (required)" value={why} onChange={e => setWhy(e.target.value)} />
          <div className="flex gap-2">
            <button className="btn-primary !px-3 !py-1.5 text-xs" disabled={!why.trim()} onClick={() => run(api(`/library/${it.id}/review`, { method: "POST", json: { approve: false, reason: why } }), "Rejected.")}>Send</button>
            <button className="btn-ghost !px-3 !py-1.5 text-xs" onClick={() => setRej(false)}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

function UploadForm({ onDone, toast }: { onDone: () => void; toast: (m: string) => void }) {
  const subjects = useFetch("/subjects");
  const [f, setF] = useState<any>({ kind: "notes", form: "0", title: "" });
  const [file, setFile] = useState<File | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k: string) => (v: string) => setF((s: any) => ({ ...s, [k]: v }));
  const paper = f.kind === "past_paper" || f.kind === "marking_scheme";

  async function submit() {
    if (!file) return;
    setBusy(true); setErr("");
    const fd = new FormData();
    Object.entries(f).forEach(([k, v]) => v !== undefined && v !== "" && fd.append(k, String(v)));
    fd.append("file", file);
    try {
      const r = await upload("/library", fd);
      toast(r.status === "approved" ? "Published." : "Sent for review.");
      onDone();
    } catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
  }

  return (
    <div className="card-static mb-6 p-5 grid gap-3 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <Field label="Title"><input className="input" value={f.title} onChange={e => set("title")(e.target.value)} placeholder="e.g. Physics Paper 2, Nov 2024" /></Field>
      </div>
      <Field label="Type">
        <Select value={f.kind} onChange={set("kind")}>{Object.entries(KINDS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select>
      </Field>
      <Field label="Subject">
        <Select value={f.subject_id} onChange={set("subject_id")}><option value="">General</option>{(subjects.data ?? []).map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select>
      </Field>
      <Field label="Form">
        <Select value={f.form} onChange={set("form")}><option value="0">All forms</option>{[1, 2, 3, 4, 5, 6].map(n => <option key={n} value={n}>Form {n}</option>)}</Select>
      </Field>
      {paper && (
        <>
          <Field label="Exam Year"><input className="input" type="number" min={1990} max={currentYear()} value={f.exam_year ?? ""} onChange={e => set("exam_year")(e.target.value)} /></Field>
          <Field label="Session">
            <Select value={f.session} onChange={set("session")}><option value="">—</option><option>June</option><option>November</option></Select>
          </Field>
          <Field label="Paper No."><input className="input" value={f.paper_no ?? ""} onChange={e => set("paper_no")(e.target.value)} placeholder="1, 2, 3..." /></Field>
        </>
      )}
      <div className="sm:col-span-2">
        <label className="btn-outline cursor-pointer border-dashed w-full justify-center">
          <Upload size={14} />
          {file ? `${file.name} (${fmtSize(file.size)})` : "Choose file (PDF, Word, Excel, PPT, Image)"}
          <input hidden type="file" accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.png,.jpg,.jpeg" onChange={e => setFile(e.target.files?.[0] ?? null)} />
        </label>
      </div>
      <div className="sm:col-span-2 flex items-center gap-3">
        <button className="btn-primary" onClick={submit} disabled={busy || !file || f.title.trim().length < 2}>{busy ? "Uploading..." : "Upload"}</button>
        <ErrorNote msg={err} />
      </div>
    </div>
  );
}

export default function Library() {
  const role = session.role();
  const canUpload = ["teacher", "librarian", "admin"].includes(role);
  const canReview = role === "librarian" || role === "admin";
  const [sp, setSp] = useSearchParams();
  const tab = sp.get("tab") ?? "browse";
  const toast = useToast();
  const [showUp, setShowUp] = useState(false);

  const [q, setQ] = useState("");
  const [kind, setKind] = useState("");
  const [subject, setSubject] = useState("");
  const [form, setForm] = useState("");
  const [sort, setSort] = useState("new");
  const [favs, setFavs] = useState(false);
  const [examYear, setExamYear] = useState("");
  const subjects = useFetch("/subjects");

  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (kind) params.set("kind", kind);
  if (subject) params.set("subject_id", subject);
  if (form) params.set("form", form);
  if (examYear) params.set("exam_year", examYear);
  if (favs) params.set("favourites", "true");
  params.set("sort", sort);

  const path = tab === "mine" ? "/library/mine" : tab === "review" ? "/library/pending" : `/library?${params}`;
  const data = useFetch(path);
  const tabs = [["browse", "Browse"], ...(canUpload ? [["mine", "My Uploads"]] : []), ...(canReview ? [["review", "Review"]] : [])];

  return (
    <div className="mx-auto max-w-6xl page-enter pb-16">
      <PageHeader eyebrow="Resources" title="Library">
        {canUpload && (
          <button className="btn-primary" onClick={() => setShowUp(s => !s)}>
            <Upload size={14} /> Add Material
          </button>
        )}
      </PageHeader>

      {showUp && <UploadForm toast={toast.show} onDone={() => { setShowUp(false); data.reload(); }} />}

      <div className="mb-5 flex gap-1 border-b border-line">
        {tabs.map(([k, l]) => (
          <button
            key={k}
            onClick={() => setSp(k === "browse" ? {} : { tab: k })}
            className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-semibold transition ${tab === k ? "border-crimson-600 text-navy-900" : "border-transparent text-slate-500 hover:text-slate-800"}`}
          >{l}</button>
        ))}
      </div>

      {tab === "browse" && (
        <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-7">
          <div className="relative lg:col-span-2">
            <Search size={15} className="absolute left-3 top-3 text-slate-400" />
            <input className="input pl-9" placeholder="Search title" value={q} onChange={e => setQ(e.target.value)} />
          </div>
          <Select aria-label="Type" value={kind} onChange={setKind}><option value="">All types</option>{Object.entries(KINDS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select>
          <Select aria-label="Subject" value={subject} onChange={setSubject}><option value="">All subjects</option>{(subjects.data ?? []).map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select>
          <Select aria-label="Form" value={form} onChange={setForm}><option value="">All forms</option>{[1, 2, 3, 4, 5, 6].map(n => <option key={n} value={n}>Form {n}</option>)}</Select>
          <Select aria-label="Year" value={examYear} onChange={setExamYear}><option value="">All years</option>{[2026, 2025, 2024, 2023, 2022, 2021, 2020].map(y => <option key={y} value={y}>{y}</option>)}</Select>
          <Select aria-label="Sort" value={sort} onChange={setSort}><option value="new">Newest</option><option value="popular">Popular</option><option value="title">A-Z</option></Select>
          {role !== "parent" && (
            <label className="flex items-center gap-2 text-sm font-medium text-slate-600">
              <input type="checkbox" className="h-4 w-4 accent-navy-700 rounded" checked={favs} onChange={e => setFavs(e.target.checked)} />
              Favourites
            </label>
          )}
        </div>
      )}

      {data.loading ? <Spinner /> : data.error ? <ErrorNote msg={data.error} /> : !(data.data ?? []).length ? (
        <Empty title={tab === "review" ? "Nothing to review" : "No resources found"} hint={tab === "browse" ? "Try different filters." : undefined} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.data.map((it: any) => <Card key={it.id} it={it} mode={tab as any} toast={toast.show} reload={data.reload} />)}
        </div>
      )}
      {toast.node}
    </div>
  );
}
