import { useEffect, useState } from "react";
import { FileDown, Send, Sparkles } from "lucide-react";
import { api, openFile, session } from "../lib/api";
import { useFetch } from "../lib/hooks";
import { currentTerm, currentYear } from "../lib/zim";
import { Empty, ErrorNote, Field, PageHeader, Select, Spinner, gradeTone, useToast } from "../components/ui";

export default function ReportCards() {
  const role = session.role(); const staff = role === "admin" || role === "teacher"; const toast = useToast();
  const [term, setTerm] = useState(String(currentTerm())); const [year, setYear] = useState(String(currentYear()));
  const classes = useFetch(staff ? "/classes" : null); const dash = useFetch(staff ? null : "/dashboard");
  const [cid, setCid] = useState(""); const students = useFetch(cid ? `/classes/${cid}/students` : null);
  const [sid, setSid] = useState(""); const [report, setReport] = useState<any>(null); const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  const [ct, setCt] = useState(""); const [hc, setHc] = useState(""); const [src, setSrc] = useState("");
  const kids = dash.data?.children ?? [];
  useEffect(() => { if (!staff && kids.length === 1) setSid(kids[0].id); }, [kids.length]);
  useEffect(() => { setReport(null); setErr(""); setSrc(""); if (!sid) return; setBusy(true);
    api(`/report-cards/${sid}?term=${term}&year=${year}`).then(setReport).catch(e => setErr(e.message)).finally(() => setBusy(false)); }, [sid, term, year]);

  async function draft() { try { const d = await api(`/ai/report-comment?student_id=${sid}&term=${term}&year=${year}`, { method: "POST" }); setCt(d.draft); setSrc(d.source); } catch (e) { toast.show((e as Error).message); } }
  async function saveComments() { try { await api(`/report-cards/${sid}/comments`, { method: "PUT", json: { term: +term, year: +year, class_teacher_comment: ct, ...(role === "admin" ? { head_comment: hc } : {}) } }); toast.show("Comments saved."); } catch (e) { toast.show((e as Error).message); } }
  async function publish() { if (!confirm(`Release Term ${term} ${year} results to all students and parents in this class?`)) return;
    try { const r = await api("/report-cards/publish", { method: "POST", json: { class_id: cid, term: +term, year: +year } }); toast.show(`Published for ${r.published} learners. Families have been notified.`); } catch (e) { toast.show((e as Error).message); } }

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader eyebrow="Results" title="Report cards" sub={staff ? "Review, comment on and publish term results." : "View and download your term reports."}>
        {role === "admin" && cid && <><button className="btn-ghost border border-line" onClick={() => openFile(`/report-cards/class/${cid}/zip?term=${term}&year=${year}`, { save: `class-reports-T${term}-${year}.zip` }).catch(e => toast.show(e.message))}><FileDown size={16} />All PDFs (ZIP)</button><button className="btn-primary" onClick={publish}><Send size={16} />Publish class results</button></>}</PageHeader>
      <div className="card mb-5 grid gap-3 p-4 sm:grid-cols-4">
        {staff ? (<><Field label="Class"><Select value={cid} onChange={v => { setCid(v); setSid(""); }}><option value="">Choose…</option>{(classes.data ?? []).map((c: any) => <option key={c.id} value={c.id}>{c.name} ({c.year})</option>)}</Select></Field>
          <Field label="Student"><Select value={sid} onChange={setSid} disabled={!cid}><option value="">Choose…</option>{(students.data ?? []).map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select></Field></>)
          : (<div className="sm:col-span-2"><Field label="Learner"><Select value={sid} onChange={setSid}><option value="">Choose…</option>{kids.map((k: any) => <option key={k.id} value={k.id}>{k.name}</option>)}</Select></Field></div>)}
        <Field label="Term"><Select value={term} onChange={setTerm}>{[1, 2, 3].map(t => <option key={t}>{t}</option>)}</Select></Field>
        <Field label="Year"><input className="input" type="number" value={year} onChange={e => setYear(e.target.value)} /></Field></div>
      {busy ? <Spinner /> : err ? <ErrorNote msg={err} /> : !report ? <Empty title={sid ? "No report yet" : "Choose a learner"} hint={sid ? "" : "Pick a learner and term to see the report."} /> : (
        <div className="card overflow-hidden">
          <div className="border-b-4 border-gold-500 bg-navy-800 px-6 py-5 text-white"><p className="text-xs uppercase tracking-widest text-gold-300">Term {report.term} · {report.year}</p>
            <h2 className="font-display text-2xl">{report.student}</h2><p className="text-sm text-navy-200">{report.class}</p></div>
          <table className="w-full text-sm"><thead className="bg-navy-50 text-left text-xs uppercase tracking-wide text-mute"><tr><th className="px-6 py-3">Subject</th><th className="px-3 py-3">Mark</th><th className="px-3 py-3">Grade</th><th className="hidden px-3 py-3 sm:table-cell">Remark</th></tr></thead>
            <tbody>{report.rows.map((r: any) => <tr key={r.subject} className="border-t border-line"><td className="px-6 py-3 font-medium">{r.subject}</td>
              <td className="px-3 py-3"><div className="flex items-center gap-2"><span className="w-9">{r.percent}%</span><div className="hidden h-1.5 w-24 rounded bg-navy-100 sm:block"><div className="h-1.5 rounded bg-gold-500" style={{ width: `${r.percent}%` }} /></div></div></td>
              <td className={`px-3 py-3 text-lg font-semibold ${gradeTone(r.grade)}`}>{r.grade}</td><td className="hidden px-3 py-3 text-mute sm:table-cell">{r.remark}</td></tr>)}</tbody></table>
          <div className="grid grid-cols-2 gap-3 border-t border-line p-5"><div className="rounded-lg bg-paper p-4 text-center"><p className="font-display text-2xl text-navy-800">{report.overall}%</p><p className="text-xs text-mute">Overall average</p></div>
            <div className="rounded-lg bg-paper p-4 text-center"><p className="font-display text-2xl text-navy-800">{report.position ?? "–"}{report.position ? ` / ${report.class_size}` : ""}</p><p className="text-xs text-mute">Class position</p></div></div>
          {staff && <div className="space-y-3 border-t border-line p-5">
            <div><div className="mb-1.5 flex items-center justify-between"><span className="label !mb-0">Class teacher's comment</span>
              <button className="btn-ghost !px-2 !py-1 text-xs" onClick={draft}><Sparkles size={14} />Draft with AI</button></div>
              <textarea className="input min-h-24" value={ct} onChange={e => setCt(e.target.value)} placeholder="Write a comment, or let the assistant draft one for you to edit." />
              {src && <p className="mt-1 text-xs text-mute">{src === "ai" ? "Drafted by AI from this learner's marks. Please read and edit before saving." : "Drafted from this learner's marks. Please read and edit before saving."}</p>}</div>
            {role === "admin" && <Field label="Headmaster's comment"><textarea className="input min-h-20" value={hc} onChange={e => setHc(e.target.value)} /></Field>}
            <button className="btn-primary" onClick={saveComments}>Save comments</button></div>}
          <div className="border-t border-line p-5"><button className="btn-primary" onClick={() => openFile(`/report-cards/${sid}/pdf?term=${term}&year=${year}`).catch(e => toast.show(e.message))}><FileDown size={16} />Open printable PDF</button></div>
        </div>)}{toast.node}
    </div>
  );
}
