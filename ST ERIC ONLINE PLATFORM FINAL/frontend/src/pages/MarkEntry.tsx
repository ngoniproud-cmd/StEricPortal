import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ArrowLeft, CheckCircle2, ChevronDown, CloudOff, Download, FileSpreadsheet, Filter, Plus, Save, Sparkles, TrendingUp, Upload, UserCheck, Users, X } from "lucide-react";
import { api, openFile, upload } from "../lib/api";
import { gradeFor } from "../lib/grading";
import { useFetch } from "../lib/hooks";
import { currentTerm, currentYear } from "../lib/zim";
import { Badge, Empty, ErrorNote, Field, PageHeader, Select, Spinner, gradeTone, useToast } from "../components/ui";

type Row = { student_id: string; admission_no: string; name: string; marks_obtained: number | null; absent: boolean };

function NewAssessment({ onDone }: { onDone: () => void }) {
  const { data: classes } = useFetch("/classes");
  const { data: subjects } = useFetch("/subjects");
  const [f, setF] = useState<any>({ term: currentTerm(), year: currentYear(), kind: "test", max_marks: 50, weight: "1.0" });
  const [err, setErr] = useState("");
  const set = (k: string) => (v: string) => setF((s: any) => ({ ...s, [k]: v }));

  async function create() {
    setErr("");
    try {
      await api("/assessments", {
        method: "POST",
        json: { ...f, term: +f.term, year: +f.year, max_marks: +f.max_marks, weight: parseFloat(f.weight) || 1.0 },
      });
      onDone();
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  return (
    <div className="card-static mb-6 overflow-hidden border-2 border-navy-200 p-6 animate-fade-in">
      <div className="border-b border-line pb-3 mb-4">
        <h3 className="font-display text-lg font-bold text-navy-900">Create New Assessment</h3>
        <p className="text-xs text-mute">Set up a test, assignment or term exam to enter marks.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Class">
          <Select value={f.class_id} onChange={set("class_id")}>
            <option value="">Choose class...</option>
            {(classes ?? []).map((c: any) => (
              <option key={c.id} value={c.id}>{c.name} ({c.year})</option>
            ))}
          </Select>
        </Field>
        <Field label="Subject">
          <Select value={f.subject_id} onChange={set("subject_id")}>
            <option value="">Choose subject...</option>
            {(subjects ?? []).map((s: any) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </Select>
        </Field>
        <Field label="Assessment Title">
          <input className="input" value={f.title ?? ""} onChange={e => set("title")(e.target.value)} placeholder="e.g. Mid-Term Test 1" />
        </Field>
        <Field label="Type">
          <Select value={f.kind} onChange={set("kind")}>
            <option value="test">Weekly Revision Test</option>
            <option value="assignment">Assignment / Project</option>
            <option value="exam">End of Term Exam (Paper 1)</option>
            <option value="exam2">End of Term Exam (Paper 2)</option>
            <option value="exam3">End of Term Exam (Practical/Oral)</option>
          </Select>
        </Field>
        <Field label="Academic Term">
          <Select value={f.term} onChange={set("term")}>
            {[1, 2, 3].map(t => (
              <option key={t} value={t}>Term {t}</option>
            ))}
          </Select>
        </Field>
        <Field label="Maximum Marks (Out Of)">
          <input className="input" type="number" min={1} value={f.max_marks} onChange={e => set("max_marks")(e.target.value)} />
        </Field>
      </div>
      <div className="mt-5 flex items-center justify-between border-t border-line pt-4">
        <ErrorNote msg={err} />
        <button className="btn-primary" onClick={create} disabled={!f.class_id || !f.subject_id || !f.title}>
          Create Assessment
        </button>
      </div>
    </div>
  );
}

export default function MarkEntry() {
  const [sp, setSp] = useSearchParams();
  const aid = sp.get("a");
  const toast = useToast();
  const list = useFetch("/assessments");
  const [showNew, setShowNew] = useState(false);
  const sheetQ = useFetch(aid ? `/assessments/${aid}/sheet` : null);

  const [rows, setRows] = useState<Row[]>([]);
  const [dirty, setDirty] = useState(false);
  const [status, setStatus] = useState("");
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [filterMode, setFilterMode] = useState<"all" | "pass" | "fail" | "missing">("all");
  const [assessmentKindTab, setAssessmentKindTab] = useState<"all" | "test" | "exam">("all");
  const inputs = useRef<(HTMLInputElement | null)[]>([]);

  const a = sheetQ.data?.assessment;
  const max = a?.max_marks ?? 0;
  const level = a?.level ?? "O";

  useEffect(() => {
    if (!sheetQ.data || !aid) return;
    const draft = localStorage.getItem(`draft:${aid}`);
    let r: Row[] = sheetQ.data.rows;
    if (draft) {
      try {
        const d: Row[] = JSON.parse(draft);
        r = r.map(x => d.find(y => y.student_id === x.student_id) ?? x);
        setDirty(true);
        toast.show("Restored unsaved marks draft from this device.");
      } catch {}
    }
    setRows(r);
    setErrs({});
  }, [sheetQ.data, aid]);

  const needReason = useMemo(() => Object.values(errs).some(e => e.includes("reason")), [errs]);

  function edit(i: number, v: string) {
    if (v === "") {
      setRows(rs => {
        const c = rs.map((r, j) => (j === i ? { ...r, marks_obtained: null, absent: false } : r));
        localStorage.setItem(`draft:${aid}`, JSON.stringify(c));
        return c;
      });
      setDirty(true);
      return;
    }
    const raw = Number(v);
    if (isNaN(raw)) return;
    if (max > 0 && raw > max) {
      toast.show(`Mark cannot exceed assessment maximum total of ${max}.`);
    }
    const n = max > 0 ? Math.min(Math.max(raw, 0), max) : Math.max(raw, 0);
    setRows(rs => {
      const c = rs.map((r, j) => (j === i ? { ...r, marks_obtained: n, absent: false } : r));
      localStorage.setItem(`draft:${aid}`, JSON.stringify(c));
      return c;
    });
    setDirty(true);
  }

  function toggleAbs(i: number) {
    setRows(rs =>
      rs.map((r, j) => (j === i ? { ...r, absent: !r.absent, marks_obtained: null } : r))
    );
    setDirty(true);
  }

  function markUnenteredAbsent() {
    setRows(rs =>
      rs.map(r => (r.marks_obtained === null && !r.absent ? { ...r, absent: true } : r))
    );
    setDirty(true);
    toast.show("Unentered learners marked as absent.");
  }

  function paste(e: React.ClipboardEvent, i: number) {
    const lines = e.clipboardData.getData("text").split(/\r?\n/).map(s => s.trim()).filter(Boolean);
    if (lines.length < 2) return;
    e.preventDefault();
    setRows(rs => {
      const c = [...rs];
      lines.forEach((t, k) => {
        if (c[i + k]) {
          const n = Number(t.replace(",", "."));
          if (!Number.isNaN(n)) {
            c[i + k] = { ...c[i + k], marks_obtained: Math.min(Math.max(n, 0), max), absent: false };
          } else if (/^a(bs)?$/i.test(t)) {
            c[i + k] = { ...c[i + k], absent: true, marks_obtained: null };
          }
        }
      });
      localStorage.setItem(`draft:${aid}`, JSON.stringify(c));
      return c;
    });
    setDirty(true);
    toast.show(`Pasted ${lines.length} marks from clipboard.`);
  }

  async function save() {
    if (!aid || busy) return;
    setBusy(true);
    try {
      const payload = rows.map(x => ({
        student_id: x.student_id,
        marks_obtained: x.marks_obtained,
        absent: x.absent,
        reason: reason || null,
      }));
      const r = await api(`/assessments/${aid}/marks`, {
        method: "PUT",
        json: {
          marks: payload,
          rows: payload,
        },
      });
      const e: Record<string, string> = {};
      r.errors.forEach((x: any) => (e[x.student_id] = x.error));
      setErrs(e);
      if (!r.errors.length) {
        localStorage.removeItem(`draft:${aid}`);
        setDirty(false);
        setReason("");
        list.reload();
      }
      setStatus(r.errors.length ? "problems" : "saved");
    } catch (x) {
      setStatus(/offline|fetch|network/i.test((x as Error).message) ? "offline" : "error:" + (x as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const saveRef = useRef(save);
  saveRef.current = save;
  useEffect(() => {
    const t = setInterval(() => {
      if (dirty && navigator.onLine && !needReason) saveRef.current();
    }, 30_000);
    return () => clearInterval(t);
  }, [dirty, needReason]);

  async function bulk(file: File) {
    const fd = new FormData();
    fd.append("file", file);
    try {
      const r = await upload(`/assessments/${aid}/marks/upload${reason ? `?reason=${encodeURIComponent(reason)}` : ""}`, fd);
      toast.show(`${r.saved} marks imported${r.errors.length ? `, ${r.errors.length} skipped: ${r.errors[0].error}` : ""}`);
      localStorage.removeItem(`draft:${aid}`);
      setDirty(false);
      sheetQ.reload();
      list.reload();
    } catch (e) {
      toast.show((e as Error).message);
    }
  }

  // Interactive metrics
  const stats = useMemo(() => {
    const valid = rows.filter(r => r.marks_obtained !== null && !r.absent);
    const count = valid.length;
    if (!count || !max) return { avg: 0, passRate: 0, highest: 0, count, missing: rows.length - count - rows.filter(r => r.absent).length };
    const pcts = valid.map(r => (r.marks_obtained! / max) * 100);
    const avg = Math.round(pcts.reduce((a, b) => a + b, 0) / count);
    const passCount = pcts.filter(p => p >= 50).length;
    const passRate = Math.round((passCount / count) * 100);
    const highest = Math.max(...pcts);
    const missing = rows.length - count - rows.filter(r => r.absent).length;
    return { avg, passRate, highest: Math.round(highest), count, missing };
  }, [rows, max]);

  // Assessment List View
  if (!aid) {
    return (
      <div className="mx-auto max-w-5xl page-enter pb-10">
        <PageHeader
          eyebrow="Evaluation"
          title="Mark Entry"
        >
          <button className="btn-primary" onClick={() => setShowNew(s => !s)}>
            <Plus size={16} /> New Assessment
          </button>
        </PageHeader>

        {showNew && <NewAssessment onDone={() => { setShowNew(false); list.reload(); }} />}

        {/* Assessment Category Tabs */}
        <div className="flex flex-wrap gap-2 mb-6">
          {[
            { id: "all", label: "All Assessments" },
            { id: "test", label: "Weekly Revision Tests" },
            { id: "exam", label: "End of Term Examinations" },
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setAssessmentKindTab(t.id as any)}
              className={`rounded-lg px-4 py-2 text-xs font-bold transition-all cursor-pointer ${
                assessmentKindTab === t.id
                  ? "bg-navy-800 text-white shadow-sm"
                  : "bg-white border border-line text-slate-600 hover:bg-navy-50"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {list.loading ? (
          <Spinner />
        ) : !(list.data ?? []).length ? (
          <Empty title="No Assessments Created" hint="Create your first test or examination marksheet to begin entering student marks." />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {(list.data ?? [])
              .filter((x: any) => {
                if (assessmentKindTab === "all") return true;
                if (assessmentKindTab === "test") return x.kind === "test";
                if (assessmentKindTab === "exam") return (x.kind ?? "").startsWith("exam");
                return true;
              })
              .map((x: any) => {
                const complete = x.entered === x.total && x.total > 0;
                const pct = x.total ? Math.round((x.entered / x.total) * 100) : 0;
                const isExam = (x.kind ?? "").startsWith("exam");
                return (
                  <button
                    key={x.id}
                    onClick={() => setSp({ a: x.id })}
                    className={`card-static group flex flex-col justify-between p-5 text-left transition-all duration-200 hover:shadow-elevated hover:-translate-y-0.5 border-t-4 ${
                      isExam ? "border-t-crimson-600" : "border-t-navy-700"
                    }`}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-display text-base font-bold text-navy-900 group-hover:text-navy-700">
                          {x.subject}
                        </span>
                        <Badge tone={complete ? "green" : "amber"}>
                          {x.entered}/{x.total}
                        </Badge>
                      </div>
                      <div className="mt-1 flex items-center gap-2">
                        <span className="text-xs font-semibold text-crimson-600 uppercase tracking-wide">
                          {x.class}
                        </span>
                        <span className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-bold ${
                          isExam ? "bg-crimson-50 text-crimson-700" : "bg-navy-50 text-navy-700"
                        }`}>
                          {isExam ? "End of Term Exam" : x.kind === "test" ? "Revision Test" : "Assignment"}
                        </span>
                      </div>
                      <p className="mt-2 text-sm text-ink">{x.title}</p>
                      <p className="mt-0.5 text-xs text-mute">
                        Term {x.term} · {x.year} · Out of {x.max_marks}
                      </p>
                    </div>

                  <div className="mt-4 pt-3 border-t border-line">
                    <div className="flex justify-between text-xs text-mute mb-1.5">
                      <span>Progress</span>
                      <span className="font-bold text-navy-900">{pct}%</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-navy-100 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-crimson-600 to-navy-600 transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
        {toast.node}
      </div>
    );
  }

  if (sheetQ.loading) return <Spinner />;
  if (sheetQ.error) return <ErrorNote msg={sheetQ.error} />;

  return (
    <div className="mx-auto max-w-4xl page-enter pb-16">
      {/* Assessment Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <button
            onClick={() => { setSp({}); setDirty(false); }}
            className="mb-2 inline-flex items-center gap-1.5 text-xs font-semibold text-navy-600 hover:text-navy-800 transition"
          >
            <ArrowLeft size={14} /> Back to all assessments
          </button>
          <h1 className="font-display text-2xl font-bold text-navy-900">{a.title}</h1>
          <p className="mt-1 text-xs text-mute">
            {a.class} · {a.subject} · Out of {max} · Weight: {a.weight ?? 1.0}x · {level === "A" ? "ZIMSEC A-Level" : "ZIMSEC O-Level"}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            className="btn-outline !py-2 text-xs"
            onClick={() => openFile(`/assessments/${aid}/template`, { save: `template-${a.title}.csv` }).catch(e => toast.show(e.message))}
          >
            <Download size={14} /> Download Template
          </button>
          <label className="btn-outline !py-2 text-xs cursor-pointer">
            <Upload size={14} /> Upload CSV
            <input type="file" hidden accept=".xlsx,.csv" onChange={e => e.target.files?.[0] && bulk(e.target.files[0])} />
          </label>
          <button className="btn-primary !py-2 text-xs" onClick={save} disabled={!dirty || busy}>
            <Save size={14} /> {busy ? "Saving..." : "Save Marks"}
          </button>
        </div>
      </div>

      {/* Interactive Statistics Strip */}
      <div className="grid grid-cols-2 gap-3 mb-6 sm:grid-cols-4">
        <div className="card-static bg-white p-3.5 text-center">
          <p className="text-[11px] font-bold uppercase tracking-wider text-mute">Class Average</p>
          <p className="mt-0.5 font-display text-2xl font-bold text-navy-900">{stats.avg}%</p>
        </div>
        <div className="card-static bg-white p-3.5 text-center">
          <p className="text-[11px] font-bold uppercase tracking-wider text-mute">Pass Rate (≥50%)</p>
          <p className="mt-0.5 font-display text-2xl font-bold text-emerald-700">{stats.passRate}%</p>
        </div>
        <div className="card-static bg-white p-3.5 text-center">
          <p className="text-[11px] font-bold uppercase tracking-wider text-mute">Top Score</p>
          <p className="mt-0.5 font-display text-2xl font-bold text-navy-900">{stats.highest}%</p>
        </div>
        <div className="card-static bg-white p-3.5 text-center">
          <p className="text-[11px] font-bold uppercase tracking-wider text-mute">Entered</p>
          <p className="mt-0.5 font-display text-2xl font-bold text-crimson-600">{stats.count}/{rows.length}</p>
        </div>
      </div>

      {/* Status & Quick Actions Bar */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-white px-4 py-2.5">
        <div className="flex items-center gap-2 text-xs">
          {status === "saved" && !dirty && (
            <span className="flex items-center gap-1.5 font-semibold text-emerald-700">
              <CheckCircle2 size={16} /> All changes saved
            </span>
          )}
          {status === "offline" && (
            <span className="flex items-center gap-1.5 font-semibold text-amber-700">
              <CloudOff size={16} /> Working offline. Changes saved locally.
            </span>
          )}
          {dirty && (
            <span className="flex items-center gap-1.5 font-semibold text-navy-700 animate-pulse">
              • Unsaved changes (autosaves in 30s)
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {stats.missing > 0 && (
            <button onClick={markUnenteredAbsent} className="btn-ghost !py-1 !px-2.5 text-xs text-mute hover:text-navy-800">
              Mark {stats.missing} Missing as Absent
            </button>
          )}
        </div>
      </div>

      {/* Audit Reason Modal if needed */}
      {needReason && (
        <div className="card-static mb-5 border-2 border-crimson-400 bg-crimson-50/30 p-5">
          <p className="font-display font-bold text-crimson-800">Official Audit Trail Justification Required</p>
          <p className="mt-1 text-xs text-mute">You are modifying previously verified assessment records. Provide an audit reason for the school administration.</p>
          <input
            className="input mt-3"
            value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder="e.g. Addition recount / Remarking verification"
          />
          <button className="btn-accent mt-3 text-xs" disabled={!reason.trim()} onClick={save}>
            Confirm and Save with Reason
          </button>
        </div>
      )}

      {/* Marks Table */}
      {!rows.length ? (
        <Empty title="No Students Enrolled" hint="No learners currently active in this class." />
      ) : (
        <div className="card-static overflow-hidden shadow-elevated border-navy-200">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-navy-800 bg-navy-800 text-xs font-semibold uppercase tracking-wider text-white">
              <tr>
                <th className="px-5 py-3.5">Learner</th>
                <th className="w-36 px-4 py-3.5">Marks Obtained</th>
                <th className="w-16 px-2 py-3.5 text-center">Absent</th>
                <th className="w-20 px-4 py-3.5 text-center">ZIMSEC Grade</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((r, i) => {
                const g = r.marks_obtained == null ? "" : gradeFor(r.marks_obtained, max, level);
                const e = errs[r.student_id];
                const pct = r.marks_obtained !== null && max ? Math.round((r.marks_obtained / max) * 100) : 0;
                return (
                  <tr key={r.student_id} className={`transition ${e ? "bg-red-50" : i % 2 === 0 ? "bg-white" : "bg-navy-50/20"}`}>
                    <td className="px-5 py-3">
                      <div className="font-semibold text-navy-900">{r.name}</div>
                      <div className="text-xs text-mute font-mono">{e ?? r.admission_no}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="relative">
                        <input
                          ref={el => (inputs.current[i] = el)}
                          aria-label={`Mark for ${r.name}`}
                          type="number"
                          inputMode="decimal"
                          min={0}
                          max={max}
                          step="0.5"
                          disabled={r.absent || a.locked}
                          className="input py-2 font-mono text-sm font-semibold disabled:bg-gray-100 disabled:text-mute"
                          value={r.marks_obtained ?? ""}
                          onChange={ev => edit(i, ev.target.value)}
                          onPaste={ev => paste(ev, i)}
                          onKeyDown={ev => {
                            if (ev.key === "Enter") {
                              ev.preventDefault();
                              inputs.current[i + 1]?.focus();
                            }
                          }}
                        />
                        {r.marks_obtained !== null && !r.absent && (
                          <span className="absolute right-3 top-2.5 text-xs font-semibold text-mute pointer-events-none">
                            {pct}%
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-2 py-3 text-center">
                      <input
                        type="checkbox"
                        aria-label={`${r.name} absent`}
                        checked={r.absent}
                        onChange={() => toggleAbs(i)}
                        className="h-5 w-5 accent-crimson-600 rounded cursor-pointer"
                      />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-grid h-8 w-8 place-items-center rounded-full font-bold text-sm ${
                        r.absent ? "bg-gray-100 text-mute" : g === "A" ? "bg-emerald-100 text-emerald-800" : g === "U" ? "bg-red-100 text-red-800" : "bg-navy-100 text-navy-800"
                      }`}>
                        {r.absent ? "ABS" : g || "–"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-4 flex items-center justify-between text-xs text-mute">
        <span>Keyboard shortcuts: Press <kbd className="rounded border bg-white px-1.5 py-0.5 font-mono">Enter</kbd> to move down. You can copy a column from Excel and paste directly into any mark field.</span>
      </div>

      {toast.node}
    </div>
  );
}
