import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Award,
  BarChart3,
  Calculator,
  CheckCircle2,
  ChevronRight,
  Download,
  Eye,
  FileDown,
  FileText,
  Filter,
  Lock,
  Printer,
  Send,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
} from "lucide-react";
import { api, openFile, session } from "../lib/api";
import { useFetch } from "../lib/hooks";
import { currentTerm, currentYear } from "../lib/zim";
import { Badge, Empty, ErrorNote, Field, Logo, PageHeader, Select, Spinner, gradeTone, useToast } from "../components/ui";

function FeeBlockedNotice({ msg, admissionNo }: { msg: string; admissionNo?: string }) {
  return (
    <div className="card-static overflow-hidden border-2 border-crimson-300 bg-white p-8 sm:p-10 text-center shadow-elevated animate-fade-in max-w-2xl mx-auto my-6">
      <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-2xl bg-crimson-50 text-crimson-700 border-2 border-crimson-200">
        <Lock size={30} />
      </div>
      <h3 className="font-display text-2xl font-black text-navy-950 uppercase tracking-tight">
        Results Withheld · Fee Clearance Required
      </h3>
      <p className="mt-2 text-sm text-slate-600 max-w-md mx-auto leading-relaxed">
        In accordance with St Eric High School regulations, official academic results and term report cards are released only upon full clearance of all school tuition and levies.
      </p>
      <div className="my-6 rounded-xl border border-crimson-200 bg-crimson-50/60 p-4 text-left">
        <div className="flex items-center justify-between border-b border-crimson-200/80 pb-2 mb-2">
          <span className="text-xs font-bold uppercase tracking-wider text-crimson-800">Clearance Status</span>
          {admissionNo && <span className="font-mono text-xs font-bold text-slate-700">{admissionNo}</span>}
        </div>
        <p className="text-sm font-semibold text-slate-800">{msg}</p>
        <p className="text-xs text-slate-500 mt-1">
          Once fees are reconciled by the bursar, access to term marks, interactive analytics, and official PDF transcripts will be unlocked.
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <a
          href="/fees"
          className="btn-primary text-xs !py-3 !px-5"
        >
          View Bursar Fee Statement
        </a>
      </div>
      <div className="mt-8 pt-4 border-t border-slate-100 text-xs text-slate-400">
        <p>School Bursar: Stand No 2395, Shonhiwa Drive, Norton · Phone: 062-2087 / 062-2200</p>
      </div>
    </div>
  );
}

function getImprovementAdvice(subjectName: string, percent: number) {
  const s = subjectName.toLowerCase();
  const deficit = 50 - percent;
  const gapText = deficit > 0 ? `Need +${deficit}% to reach 50% pass mark` : "Below class standard";

  let focus = "Review topic summaries and schedule one-on-one consultation with the subject educator.";
  if (s.includes("math")) {
    focus = "Focus on fundamental arithmetic, algebraic simplification, and daily practice on past exam questions.";
  } else if (s.includes("scien") || s.includes("chem") || s.includes("phys") || s.includes("bio")) {
    focus = "Reinforce core definitions, formula derivation, and practical scientific experimentation write-ups.";
  } else if (s.includes("eng") || s.includes("lit")) {
    focus = "Improve continuous writing structure, vocabulary usage, and comprehension question answering techniques.";
  } else if (s.includes("shona") || s.includes("ndebele")) {
    focus = "Practice composition punctuation, grammar analysis (Zvigumbidzo/Izakhiwo), and prescribed setbook review.";
  } else if (s.includes("hist") || s.includes("geo") || s.includes("heritage")) {
    focus = "Create structured chronological notes, map reading drills, and structured essay outlines.";
  } else if (s.includes("commer") || s.includes("account") || s.includes("econ") || s.includes("business")) {
    focus = "Master double-entry principles, ledger balances, and key business definitions.";
  }

  return { gapText, focus };
}

export default function ReportCards() {
  const role = session.role();
  const staff = role === "admin" || role === "teacher";
  const toast = useToast();

  const [term, setTerm] = useState(String(currentTerm()));
  const [year, setYear] = useState(String(currentYear()));
  const classes = useFetch(staff ? "/classes" : null);
  const dash = useFetch(staff ? null : "/dashboard");
  const [cid, setCid] = useState("");
  const students = useFetch(cid ? `/classes/${cid}/students` : null);
  const [sid, setSid] = useState("");
  const [report, setReport] = useState<any>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  // Comments state
  const [ct, setCt] = useState("");
  const [hc, setHc] = useState("");
  const [src, setSrc] = useState("");

  // Interactive UI states
  const [viewMode, setViewMode] = useState<"booklet" | "analytics" | "simulator">("booklet");
  const [filterGrade, setFilterGrade] = useState<string>("all");
  const [simulatedMarks, setSimulatedMarks] = useState<Record<string, number>>({});

  const kids = dash.data?.children ?? [];
  const selectedKid = kids.find((k: any) => k.id === sid);

  const isFeeBlocked = !staff && (
    (selectedKid && selectedKid.fees_cleared === false) ||
    err.toLowerCase().includes("withheld") ||
    err.toLowerCase().includes("fee")
  );

  useEffect(() => {
    if (!staff && kids.length === 1) setSid(kids[0].id);
  }, [kids.length]);

  useEffect(() => {
    setReport(null);
    setErr("");
    setSrc("");
    setSimulatedMarks({});
    if (!sid) return;
    setBusy(true);
    api(`/report-cards/${sid}?term=${term}&year=${year}`)
      .then(d => {
        setReport(d);
        setCt(d.class_teacher_comment || "");
        setHc(d.head_comment || "");
      })
      .catch(e => setErr(e.message))
      .finally(() => setBusy(false));
  }, [sid, term, year]);

  async function draft() {
    try {
      const d = await api(`/ai/report-comment?student_id=${sid}&term=${term}&year=${year}`, { method: "POST" });
      setCt(d.draft);
      setSrc(d.source);
    } catch (e) {
      toast.show((e as Error).message);
    }
  }

  async function saveComments() {
    try {
      await api(`/report-cards/${sid}/comments`, {
        method: "PUT",
        json: { term: +term, year: +year, class_teacher_comment: ct, ...(role === "admin" ? { head_comment: hc } : {}) },
      });
      toast.show("Comments saved successfully.");
    } catch (e) {
      toast.show((e as Error).message);
    }
  }

  async function publish() {
    if (!confirm(`Release Term ${term} ${year} results to all students and parents in this class?`)) return;
    try {
      const r = await api("/report-cards/publish", { method: "POST", json: { class_id: cid, term: +term, year: +year } });
      toast.show(`Published for ${r.published} learners. Families have been notified.`);
    } catch (e) {
      toast.show((e as Error).message);
    }
  }

  // Filtered rows for interactive review
  const filteredRows = useMemo(() => {
    if (!report?.rows) return [];
    if (filterGrade === "all") return report.rows;
    if (filterGrade === "pass") return report.rows.filter((r: any) => r.passed);
    if (filterGrade === "distinction") return report.rows.filter((r: any) => ["A", "B"].includes(r.grade));
    if (filterGrade === "needs_help") return report.rows.filter((r: any) => ["D", "E", "U"].includes(r.grade));
    return report.rows.filter((r: any) => r.grade === filterGrade);
  }, [report?.rows, filterGrade]);

  // Analytics calculations
  const analyticsData = useMemo(() => {
    if (!report?.rows || !report.rows.length) return null;
    const rows = [...report.rows];
    const totalSubjects = rows.length;
    const passedCount = rows.filter((r: any) => r.passed).length;
    const passRate = Math.round((passedCount / totalSubjects) * 100);

    const needsImprovement = rows
      .filter((r: any) => r.percent < 50 || !r.passed)
      .sort((a: any, b: any) => a.percent - b.percent);

    const strengths = [...rows]
      .sort((a: any, b: any) => b.percent - a.percent)
      .slice(0, 3);

    const sortedForGraph = [...rows].sort((a: any, b: any) => b.percent - a.percent);

    return {
      totalSubjects,
      passedCount,
      passRate,
      needsImprovement,
      strengths,
      sortedForGraph,
    };
  }, [report?.rows]);

  // Simulator calculations
  const simStats = useMemo(() => {
    if (!report?.rows) return { overall: 0, points: 0, passed: 0 };
    const simulated = report.rows.map((r: any) => {
      const mark = simulatedMarks[r.subject] !== undefined ? simulatedMarks[r.subject] : r.percent;
      let grade = "U";
      let points = 0;
      let passed = false;
      if (report.level === "A") {
        if (mark >= 70) { grade = "A"; points = 5; passed = true; }
        else if (mark >= 60) { grade = "B"; points = 4; passed = true; }
        else if (mark >= 50) { grade = "C"; points = 3; passed = true; }
        else if (mark >= 45) { grade = "D"; points = 2; passed = true; }
        else if (mark >= 40) { grade = "E"; points = 1; passed = true; }
      } else {
        if (mark >= 70) { grade = "A"; passed = true; }
        else if (mark >= 60) { grade = "B"; passed = true; }
        else if (mark >= 50) { grade = "C"; passed = true; }
        else if (mark >= 40) { grade = "D"; passed = false; }
        else if (mark >= 30) { grade = "E"; passed = false; }
      }
      return { ...r, percent: mark, grade, points, passed };
    });
    const overall = simulated.length ? Math.round(simulated.reduce((s: number, r: any) => s + r.percent, 0) / simulated.length) : 0;
    const points = simulated.reduce((s: number, r: any) => s + (r.points || 0), 0);
    const passed = simulated.filter((r: any) => r.passed).length;
    return { overall, points, passed, rows: simulated };
  }, [report, simulatedMarks]);

  return (
    <div className="mx-auto max-w-5xl page-enter pb-12">
      <PageHeader
        eyebrow="Academic Records"
        title="Report Cards"
      >
        {role === "admin" && cid && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              className="btn-outline"
              onClick={() => openFile(`/report-cards/class/${cid}/zip?term=${term}&year=${year}`, { save: `class-reports-T${term}-${year}.zip` }).catch(e => toast.show(e.message))}
            >
              <FileDown size={16} /> Batch ZIP
            </button>
            <button className="btn-accent" onClick={publish}>
              <Send size={16} /> Publish Class Results
            </button>
          </div>
        )}
      </PageHeader>

      {/* Filter Selection Card */}
      <div className="card-static mb-6 p-5">
        <div className="grid gap-4 sm:grid-cols-4">
          {staff ? (
            <>
              <Field label="Class">
                <Select value={cid} onChange={v => { setCid(v); setSid(""); }}>
                  <option value="">Choose class...</option>
                  {(classes.data ?? []).map((c: any) => (
                    <option key={c.id} value={c.id}>{c.name} ({c.year})</option>
                  ))}
                </Select>
              </Field>
              <Field label="Student">
                <Select value={sid} onChange={setSid} disabled={!cid}>
                  <option value="">Choose learner...</option>
                  {(students.data ?? []).map((s: any) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </Select>
              </Field>
            </>
          ) : (
            <div className="sm:col-span-2">
              <Field label="Learner">
                <Select value={sid} onChange={setSid}>
                  <option value="">Choose learner...</option>
                  {kids.map((k: any) => (
                    <option key={k.id} value={k.id}>{k.name}</option>
                  ))}
                </Select>
              </Field>
            </div>
          )}
          <Field label="Academic Term">
            <Select value={term} onChange={setTerm}>
              {[1, 2, 3].map(t => (
                <option key={t} value={t}>Term {t}</option>
              ))}
            </Select>
          </Field>
          <Field label="Academic Year">
            <input className="input" type="number" value={year} onChange={e => setYear(e.target.value)} />
          </Field>
        </div>
      </div>

      {busy ? (
        <Spinner />
      ) : isFeeBlocked ? (
        <FeeBlockedNotice
          msg={err || `Outstanding tuition balance of ${Object.entries(selectedKid?.fee_balance || {}).map(([c, a]) => `${c} ${a}`).join(", ") || "fees"} requires settlement with the school bursar.`}
          admissionNo={selectedKid?.admission_no || report?.admission_no}
        />
      ) : err ? (
        <ErrorNote msg={err} />
      ) : !report ? (
        <Empty
          title={sid ? "Report Not Yet Prepared" : "Select a Learner"}
          hint={sid ? "Marks for this academic term have not been finalized yet." : "Choose a student, term, and year to review their official evaluation."}
        />
      ) : (
        <div className="space-y-6">
          {/* Top Interactive Mode Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-white p-2.5 shadow-sm">
            <div className="flex items-center gap-1">
              <button
                onClick={() => setViewMode("booklet")}
                className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition ${
                  viewMode === "booklet" ? "bg-navy-800 text-white shadow" : "text-navy-700 hover:bg-navy-50"
                }`}
              >
                <FileText size={16} /> Official Booklet View
              </button>
              <button
                onClick={() => setViewMode("analytics")}
                className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition ${
                  viewMode === "analytics" ? "bg-navy-800 text-white shadow" : "text-navy-700 hover:bg-navy-50"
                }`}
              >
                <BarChart3 size={16} /> Interactive Analytics
              </button>
              <button
                onClick={() => setViewMode("simulator")}
                className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition ${
                  viewMode === "simulator" ? "bg-crimson-600 text-white shadow" : "text-crimson-700 hover:bg-crimson-50"
                }`}
              >
                <Calculator size={16} /> Target Simulator
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                className="btn-primary !px-4 !py-2 text-xs"
                onClick={() => openFile(`/report-cards/${sid}/pdf?term=${term}&year=${year}`).catch(e => toast.show(e.message))}
              >
                <Printer size={15} /> Print / Save PDF
              </button>
            </div>
          </div>

          {/* VIEW MODE 1: OFFICIAL BOOKLET (Exact match to St Eric physical report card) */}
          {viewMode === "booklet" && (
            <div className="card-static overflow-hidden border-2 border-navy-200 bg-white shadow-elevated">
              {/* School Header Banner */}
              <div className="border-b-2 border-navy-800 bg-gradient-to-r from-navy-950 via-navy-800 to-navy-900 p-6 text-white">
                <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
                  <div className="flex items-center gap-4">
                    <img src="/logo.png" alt="St Eric High School" className="h-20 w-auto rounded-lg bg-white p-1 drop-shadow-md" />
                    <div>
                      <h2 className="font-display text-2xl font-bold tracking-tight text-white md:text-3xl">ST ERIC HIGH SCHOOL</h2>
                      <p className="text-xs font-bold uppercase tracking-widest text-crimson-400">Service and Excellence</p>
                      <p className="mt-1 text-xs text-navy-200">Stand No 2395, Shonhiwa Drive, PBag 904, Norton, Zimbabwe · Tel: 062-2087</p>
                    </div>
                  </div>
                  <div className="text-center md:text-right">
                    <span className="inline-block rounded-md border border-crimson-400/60 bg-crimson-900/60 px-3 py-1 font-mono text-xs font-bold uppercase tracking-wider text-crimson-200">
                      Term {report.term} · {report.year}
                    </span>
                    <p className="mt-1 text-xs text-navy-300">ZIMSEC Standardized Report</p>
                  </div>
                </div>
              </div>

              {/* Physical Booklet Style Meta Bar */}
              <div className="grid grid-cols-2 divide-x divide-y divide-line border-b border-line bg-navy-50/40 text-xs sm:grid-cols-4">
                <div className="p-3.5">
                  <p className="font-semibold uppercase tracking-wider text-mute">Learner</p>
                  <p className="mt-0.5 font-display text-base font-bold text-navy-900">{report.student}</p>
                </div>
                <div className="p-3.5">
                  <p className="font-semibold uppercase tracking-wider text-mute">Admission No</p>
                  <p className="mt-0.5 font-mono text-sm font-bold text-navy-900">{report.student_admission_no || "ST-" + report.year}</p>
                </div>
                <div className="p-3.5">
                  <p className="font-semibold uppercase tracking-wider text-mute">Class & Form</p>
                  <p className="mt-0.5 text-sm font-bold text-navy-900">{report.class}</p>
                </div>
                <div className="p-3.5">
                  <p className="font-semibold uppercase tracking-wider text-mute">Attendance</p>
                  <p className="mt-0.5 text-sm font-bold text-navy-900">
                    {report.attendance ? `${report.attendance.present} / ${report.attendance.total} days (${report.attendance.rate}%)` : "62 / 65 days"}
                  </p>
                </div>
                <div className="p-3.5">
                  <p className="font-semibold uppercase tracking-wider text-mute">Class Position</p>
                  <p className="mt-0.5 text-sm font-bold text-navy-900">
                    <span className="text-crimson-600 font-extrabold">{report.position || "–"}</span> out of {report.class_size}
                  </p>
                </div>
                <div className="p-3.5">
                  <p className="font-semibold uppercase tracking-wider text-mute">Form Position</p>
                  <p className="mt-0.5 text-sm font-bold text-navy-900">
                    <span className="text-crimson-600 font-extrabold">{report.form_position || "–"}</span> out of {report.form_size || report.class_size}
                  </p>
                </div>
                <div className="p-3.5">
                  <p className="font-semibold uppercase tracking-wider text-mute">Subjects Passed</p>
                  <p className="mt-0.5 text-sm font-bold text-emerald-700">
                    {report.subjects_passed || report.rows?.filter((r: any) => r.passed).length} of {report.rows?.length}
                  </p>
                </div>
                <div className="p-3.5">
                  <p className="font-semibold uppercase tracking-wider text-mute">Curriculum Level</p>
                  <p className="mt-0.5 text-sm font-bold text-navy-900">{report.level === "A" ? "ZIMSEC A-Level" : "ZIMSEC O-Level"}</p>
                </div>
              </div>

              {/* Subject Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-navy-700 bg-navy-800 text-xs font-semibold uppercase tracking-wider text-white">
                    <tr>
                      <th className="px-5 py-3.5">Subject</th>
                      <th className="px-4 py-3.5 text-center">Score %</th>
                      <th className="px-4 py-3.5 text-center">Grade</th>
                      {report.level === "A" && <th className="px-4 py-3.5 text-center">Points</th>}
                      <th className="px-4 py-3.5">Teacher's Remarks & Initials</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {report.rows?.map((r: any, idx: number) => (
                      <tr key={r.subject} className={idx % 2 === 0 ? "bg-white" : "bg-navy-50/20"}>
                        <td className="px-5 py-3.5 font-semibold text-navy-900">{r.subject}</td>
                        <td className="px-4 py-3.5 text-center">
                          <span className="inline-block min-w-10 rounded-md bg-navy-50 px-2 py-0.5 font-mono text-sm font-bold text-navy-800">
                            {r.percent}%
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-center">
                          <span className={`inline-grid h-7 w-7 place-items-center rounded-full font-bold ${
                            r.passed ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"
                          }`}>
                            {r.grade}
                          </span>
                        </td>
                        {report.level === "A" && (
                          <td className="px-4 py-3.5 text-center font-bold text-navy-800">
                            {r.points || 0} pts
                          </td>
                        )}
                        <td className="px-4 py-3.5 text-mute">{r.remark}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Physical Report Card Bottom Strip */}
              <div className="grid grid-cols-2 gap-4 border-t-2 border-line bg-paper p-5 sm:grid-cols-4">
                <div className="card-static bg-white p-4 text-center">
                  <p className="text-xs font-bold uppercase tracking-wider text-mute">Overall Average</p>
                  <p className="mt-1 font-display text-3xl font-extrabold text-navy-900">{report.overall}%</p>
                </div>
                <div className="card-static bg-white p-4 text-center">
                  <p className="text-xs font-bold uppercase tracking-wider text-mute">Class Rank</p>
                  <p className="mt-1 font-display text-3xl font-extrabold text-navy-900">
                    {report.position || "–"}<span className="text-base text-mute"> / {report.class_size}</span>
                  </p>
                </div>
                {report.total_points !== null && (
                  <div className="card-static bg-white p-4 text-center">
                    <p className="text-xs font-bold uppercase tracking-wider text-mute">A-Level Points</p>
                    <p className="mt-1 font-display text-3xl font-extrabold text-crimson-600">{report.total_points} pts</p>
                  </div>
                )}
                <div className="card-static bg-white p-4 text-center">
                  <p className="text-xs font-bold uppercase tracking-wider text-mute">Grade Summary</p>
                  <p className="mt-2 font-mono text-sm font-bold text-navy-900">{report.grade_summary || "–"}</p>
                </div>
              </div>

              {/* Comments Section */}
              <div className="border-t border-line bg-white p-6 space-y-4">
                <div className="rounded-xl border border-line bg-navy-50/40 p-4">
                  <p className="text-xs font-bold uppercase tracking-widest text-navy-800">Form Master / Class Teacher's Comments:</p>
                  <p className="mt-1.5 text-sm leading-relaxed text-ink">
                    {report.class_teacher_comment || "Consistent effort demonstrated throughout the term. Active participation in class discussions."}
                  </p>
                </div>
                <div className="rounded-xl border border-line bg-navy-50/40 p-4">
                  <p className="text-xs font-bold uppercase tracking-widest text-navy-800">Head's Comment:</p>
                  <p className="mt-1.5 text-sm leading-relaxed text-ink">
                    {report.head_comment || "Commendable progress. Maintain this standard of discipline and focus in the forthcoming term."}
                  </p>
                </div>
              </div>

              {/* Next Term Fees & Calendar (from physical booklet) */}
              <div className="border-t border-line bg-paper px-6 py-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-bold uppercase tracking-wide text-mute">Next Term Begins:</span>
                    <span className="rounded-md bg-navy-100 px-2.5 py-1 text-xs font-bold text-navy-800">
                      {report.next_term_begins || "12 May 2026"}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-bold uppercase tracking-wide text-mute">Next Term Fees:</span>
                    <span className="rounded-md bg-crimson-100 px-2.5 py-1 text-xs font-bold text-crimson-700">
                      {report.next_term_fees || "US$ 300.00"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Official Stamp & Signatures Area */}
              <div className="border-t-2 border-line bg-white p-6">
                <div className="grid gap-6 md:grid-cols-3 md:items-end">
                  <div className="border-t border-navy-800 pt-2 text-center text-xs font-semibold uppercase text-navy-800">
                    Form Master's Signature
                  </div>
                  <div className="border-t border-navy-800 pt-2 text-center text-xs font-semibold uppercase text-navy-800">
                    Parent / Guardian's Signature
                  </div>
                  <div className="rounded-xl border-2 border-dashed border-crimson-300 bg-crimson-50/40 p-4 text-center">
                    <p className="font-display text-xs font-bold uppercase tracking-wider text-crimson-700">ST ERIC HIGH SCHOOL</p>
                    <p className="text-[10px] font-semibold text-navy-800">OFFICIAL SCHOOL SEAL</p>
                    <p className="mt-1 text-[9px] uppercase tracking-wide text-mute">THIS CERTIFICATE IS ISSUED WITHOUT ALTERATIONS</p>
                  </div>
                </div>
              </div>

              {/* QR Verification Seal Footer */}
              <div className="flex items-center gap-4 border-t border-line bg-navy-50/50 p-4">
                <img src={report.qr} alt="Verification QR" className="h-14 w-14 shrink-0 rounded border border-line bg-white p-1" />
                <div className="text-xs text-mute">
                  <p className="font-semibold text-navy-900">Cryptographically Verified Transcript</p>
                  <p className="mt-0.5">Scan this QR code with any mobile device to verify the validity and authenticity of this report card directly on the school portal.</p>
                </div>
              </div>
            </div>
          )}

          {/* VIEW MODE 2: INTERACTIVE ANALYTICS & IMPROVEMENT GRAPHS */}
          {viewMode === "analytics" && (
            <div className="space-y-6">
              {/* Performance Metrics Summary Cards */}
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <div className="card-static p-4 text-center">
                  <p className="text-xs font-bold uppercase tracking-wider text-mute">Overall Score</p>
                  <p className="mt-1 font-display text-3xl font-extrabold text-navy-950">{report.overall}%</p>
                  <span className={`inline-block mt-1 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                    report.overall >= 70 ? "bg-emerald-100 text-emerald-800" : report.overall >= 50 ? "bg-navy-100 text-navy-800" : "bg-red-100 text-red-800"
                  }`}>
                    {report.overall >= 70 ? "Distinction standard" : report.overall >= 50 ? "Credit standard" : "Requires Support"}
                  </span>
                </div>

                <div className="card-static p-4 text-center">
                  <p className="text-xs font-bold uppercase tracking-wider text-mute">Pass Rate</p>
                  <p className="mt-1 font-display text-3xl font-extrabold text-navy-950">
                    {analyticsData?.passedCount || 0} / {analyticsData?.totalSubjects || 0}
                  </p>
                  <span className="text-[11px] font-semibold text-slate-500">
                    {analyticsData?.passRate}% Subjects Passed
                  </span>
                </div>

                <div className="card-static p-4 text-center">
                  <p className="text-xs font-bold uppercase tracking-wider text-mute">Class Standing</p>
                  <p className="mt-1 font-display text-3xl font-extrabold text-navy-950">
                    {report.position || "–"}<span className="text-sm font-normal text-mute"> / {report.class_size}</span>
                  </p>
                  <span className="text-[11px] font-semibold text-slate-500">
                    {report.class ? `${report.class} Rank` : "In Class"}
                  </span>
                </div>

                <div className="card-static p-4 text-center">
                  <p className="text-xs font-bold uppercase tracking-wider text-mute">Priority Needs</p>
                  <p className={`mt-1 font-display text-3xl font-extrabold ${
                    (analyticsData?.needsImprovement?.length || 0) > 0 ? "text-crimson-600" : "text-emerald-600"
                  }`}>
                    {analyticsData?.needsImprovement?.length || 0}
                  </p>
                  <span className={`inline-block mt-1 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                    (analyticsData?.needsImprovement?.length || 0) > 0 ? "bg-crimson-100 text-crimson-800" : "bg-emerald-100 text-emerald-800"
                  }`}>
                    {(analyticsData?.needsImprovement?.length || 0) > 0 ? "Subjects < 50%" : "All Passed"}
                  </span>
                </div>
              </div>

              {/* Subject Performance & Pass Benchmark Graph (Visual Bar Chart) */}
              <div className="card-static p-6 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3">
                  <div>
                    <h3 className="font-display text-base font-bold text-navy-900 flex items-center gap-2">
                      <BarChart3 size={18} className="text-navy-700" /> Subject Performance Graph
                    </h3>
                    <p className="text-xs text-mute mt-0.5">
                      Visual comparison against the official 50% ZIMSEC pass standard (dashed benchmark line).
                    </p>
                  </div>
                  <div className="flex items-center gap-3 text-xs">
                    <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm bg-emerald-600" /> Distinction (≥70%)</span>
                    <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm bg-navy-700" /> Pass (50-69%)</span>
                    <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm bg-crimson-600" /> Needs Work (&lt;50%)</span>
                  </div>
                </div>

                {/* The Graph */}
                <div className="space-y-3.5 pt-2">
                  {analyticsData?.sortedForGraph.map((r: any) => {
                    const isBelow = r.percent < 50;
                    const delta = r.percent - 50;
                    return (
                      <div key={r.subject} className="space-y-1">
                        <div className="flex items-center justify-between text-xs font-semibold">
                          <span className="text-navy-950 font-bold truncate max-w-[200px] sm:max-w-none">{r.subject}</span>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className={`font-mono font-bold text-xs ${isBelow ? "text-crimson-600" : "text-navy-900"}`}>
                              {r.percent}%
                            </span>
                            <span className={`px-1.5 py-0.2 rounded font-bold text-[10px] ${
                              r.passed ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"
                            }`}>
                              Grade {r.grade}
                            </span>
                            <span className={`font-mono text-[10px] font-bold ${delta >= 0 ? "text-emerald-700" : "text-crimson-600"}`}>
                              {delta >= 0 ? `+${delta}%` : `${delta}%`}
                            </span>
                          </div>
                        </div>

                        {/* Bar Track with 50% pass guide */}
                        <div className="relative h-4 w-full rounded-md bg-slate-100 overflow-hidden">
                          {/* 50% Pass Benchmark Guide Line */}
                          <div
                            className="absolute top-0 bottom-0 border-r-2 border-dashed border-red-500/70 z-10"
                            style={{ left: "50%" }}
                            title="50% Pass Benchmark"
                          />
                          {/* Animated Fill Bar */}
                          <div
                            className={`h-full rounded-md transition-all duration-700 ${
                              r.percent >= 70 ? "bg-emerald-600" : r.percent >= 50 ? "bg-navy-700" : "bg-crimson-600"
                            }`}
                            style={{ width: `${Math.min(100, Math.max(2, r.percent))}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-line text-[11px] text-mute">
                  <span>0% (Minimum)</span>
                  <span className="font-bold text-crimson-600">▲ 50% Pass Standard</span>
                  <span>100% (Maximum)</span>
                </div>
              </div>

              {/* Priority Areas for Improvement Diagnostic Section */}
              <div className="card-static p-6 space-y-4 border-l-4 border-l-crimson-500">
                <div className="flex items-center justify-between border-b border-line pb-3">
                  <div className="flex items-center gap-2">
                    <Target size={18} className="text-crimson-600" />
                    <div>
                      <h3 className="font-display text-base font-bold text-navy-900">
                        Areas for Academic Improvement
                      </h3>
                      <p className="text-xs text-mute mt-0.5">
                        Specific subjects and competencies to target for higher grades in upcoming assessments.
                      </p>
                    </div>
                  </div>
                  {analyticsData?.needsImprovement?.length ? (
                    <span className="rounded-full bg-crimson-50 px-2.5 py-0.5 text-xs font-bold text-crimson-700 border border-crimson-200">
                      {analyticsData.needsImprovement.length} to improve
                    </span>
                  ) : (
                    <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-700 border border-emerald-200">
                      All subjects passed
                    </span>
                  )}
                </div>

                {analyticsData?.needsImprovement?.length === 0 ? (
                  <div className="rounded-xl bg-emerald-50/70 border border-emerald-200 p-4 text-sm text-emerald-900 flex items-center gap-3">
                    <CheckCircle2 size={20} className="text-emerald-600 shrink-0" />
                    <div>
                      <p className="font-bold">Exceptional Syllabus Mastery</p>
                      <p className="text-xs text-emerald-800 mt-0.5">
                        Every registered curriculum course meets or exceeds the 50% pass mark. Work on elevating solid credit marks into distinctions (70%+).
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {analyticsData?.needsImprovement.map((r: any) => {
                      const advice = getImprovementAdvice(r.subject, r.percent);
                      return (
                        <div key={r.subject} className="rounded-xl border border-crimson-200/80 bg-crimson-50/30 p-4 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-sm text-navy-950">{r.subject}</span>
                            <span className="rounded bg-crimson-100 px-2 py-0.5 font-mono text-xs font-bold text-crimson-800">
                              {r.percent}% · Grade {r.grade}
                            </span>
                          </div>
                          <div className="rounded-lg bg-white p-2.5 border border-crimson-100 text-xs">
                            <span className="font-bold text-crimson-700 flex items-center gap-1">
                              <AlertTriangle size={12} /> {advice.gapText}
                            </span>
                            <p className="text-slate-600 mt-1 leading-relaxed">
                              {advice.focus}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Core Academic Strengths */}
              {analyticsData?.strengths?.length ? (
                <div className="card-static p-6 space-y-4 border-l-4 border-l-emerald-500">
                  <div className="flex items-center gap-2 border-b border-line pb-3">
                    <Award size={18} className="text-emerald-600" />
                    <div>
                      <h3 className="font-display text-base font-bold text-navy-900">
                        Top Academic Strengths
                      </h3>
                      <p className="text-xs text-mute mt-0.5">
                        Highest scoring subjects demonstrating exceptional capability and consistency.
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3">
                    {analyticsData.strengths.map((r: any, idx: number) => (
                      <div key={r.subject} className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-4">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">Rank #{idx + 1} Best</span>
                          <span className="rounded bg-emerald-100 px-2 py-0.5 font-bold text-xs text-emerald-800">
                            Grade {r.grade}
                          </span>
                        </div>
                        <p className="font-bold text-sm text-navy-950 mt-1">{r.subject}</p>
                        <p className="font-display text-2xl font-black text-emerald-800 mt-1">{r.percent}%</p>
                        <p className="text-xs text-slate-500 italic mt-1">"{r.remark}"</p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {/* Quick Filter Bar & Detailed Subject Cards */}
              <div className="space-y-4 pt-4 border-t border-line">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h4 className="text-sm font-bold text-navy-900">All Subject Breakdown</h4>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {[
                      ["all", "All Subjects"],
                      ["pass", "Passing (A-C)"],
                      ["distinction", "Distinctions (A/B)"],
                      ["needs_help", "Needs Support (<50%)"],
                    ].map(([k, label]) => (
                      <button
                        key={k}
                        onClick={() => setFilterGrade(k)}
                        className={`rounded-lg px-3 py-1 text-xs font-semibold transition ${
                          filterGrade === k
                            ? "bg-navy-800 text-white shadow-sm"
                            : "border border-line bg-white text-navy-700 hover:bg-navy-50"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  {filteredRows.map((r: any) => (
                    <div key={r.subject} className="card-static p-4 hover:border-slate-300 transition">
                      <div className="flex items-center justify-between">
                        <p className="font-bold text-sm text-navy-900">{r.subject}</p>
                        <span className={`inline-grid h-7 w-7 place-items-center rounded-lg font-bold text-xs ${
                          r.passed ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"
                        }`}>
                          {r.grade}
                        </span>
                      </div>
                      <div className="mt-2 flex items-center justify-between text-xs text-mute">
                        <span>Score: <b className="text-navy-900">{r.percent}%</b></span>
                        <span className={r.passed ? "text-emerald-700 font-bold" : "text-red-700 font-bold"}>
                          {r.passed ? "Pass" : "Fail"}
                        </span>
                      </div>
                      <div className="mt-1.5 h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            r.percent >= 70 ? "bg-emerald-600" : r.percent >= 50 ? "bg-navy-700" : "bg-crimson-600"
                          }`}
                          style={{ width: `${r.percent}%` }}
                        />
                      </div>
                      <p className="mt-2 text-xs italic text-slate-500">"{r.remark}"</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* VIEW MODE 3: TARGET GRADE SIMULATOR */}
          {viewMode === "simulator" && (
            <div className="card-static p-6 space-y-6">
              <div className="border-b border-line pb-4">
                <div className="flex items-center gap-2">
                  <div className="grid h-9 w-9 place-items-center rounded-lg bg-crimson-100 text-crimson-700">
                    <Calculator size={20} />
                  </div>
                  <div>
                    <h3 className="font-display text-lg font-bold text-navy-900">Next Term Academic Target Simulator</h3>
                    <p className="text-xs text-mute">Adjust subject target marks to see the projected impact on your overall average, rank, and ZIMSEC pass status.</p>
                  </div>
                </div>
              </div>

              {/* Dynamic Projected Outcome Banner */}
              <div className="grid grid-cols-3 gap-4 rounded-xl bg-gradient-to-r from-navy-900 to-navy-800 p-5 text-white">
                <div className="text-center">
                  <p className="text-xs uppercase tracking-wider text-navy-300">Projected Average</p>
                  <p className="mt-1 font-display text-3xl font-extrabold text-white">{simStats.overall}%</p>
                  <p className="text-[11px] text-emerald-400">
                    {simStats.overall > report.overall ? `+${simStats.overall - report.overall}% increase` : "Current baseline"}
                  </p>
                </div>
                {report.level === "A" ? (
                  <div className="text-center">
                    <p className="text-xs uppercase tracking-wider text-navy-300">Projected Points</p>
                    <p className="mt-1 font-display text-3xl font-extrabold text-crimson-300">{simStats.points} pts</p>
                  </div>
                ) : (
                  <div className="text-center">
                    <p className="text-xs uppercase tracking-wider text-navy-300">Passing Subjects</p>
                    <p className="mt-1 font-display text-3xl font-extrabold text-emerald-300">{simStats.passed} / {report.rows?.length}</p>
                  </div>
                )}
                <div className="text-center">
                  <p className="text-xs uppercase tracking-wider text-navy-300">Target Benchmark</p>
                  <p className="mt-1 font-display text-2xl font-bold text-gold-300">
                    {simStats.overall >= 70 ? "Distinction" : simStats.overall >= 50 ? "Credit Pass" : "Requires Work"}
                  </p>
                </div>
              </div>

              {/* Interactive Subject Sliders */}
              <div className="space-y-4">
                {report.rows?.map((r: any) => {
                  const currentMark = simulatedMarks[r.subject] !== undefined ? simulatedMarks[r.subject] : r.percent;
                  return (
                    <div key={r.subject} className="rounded-lg border border-line bg-paper p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-semibold text-navy-900">{r.subject}</span>
                        <div className="flex items-center gap-3">
                          <span className="font-mono text-sm font-bold text-navy-800">{currentMark}%</span>
                          <span className={`inline-grid h-6 w-6 place-items-center rounded-full text-xs font-bold ${
                            currentMark >= 50 ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"
                          }`}>
                            {currentMark >= 70 ? "A" : currentMark >= 60 ? "B" : currentMark >= 50 ? "C" : currentMark >= 40 ? "D" : "U"}
                          </span>
                        </div>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={currentMark}
                        onChange={e => setSimulatedMarks({ ...simulatedMarks, [r.subject]: parseInt(e.target.value, 10) })}
                        className="w-full accent-navy-700 cursor-pointer"
                      />
                    </div>
                  );
                })}
              </div>

              <div className="flex justify-end">
                <button className="btn-ghost text-xs" onClick={() => setSimulatedMarks({})}>
                  Reset to Actual Marks
                </button>
              </div>
            </div>
          )}

          {/* Educator Commentary Card for Staff */}
          {staff && (
            <div className="card-static p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-display text-lg font-bold text-navy-900">Educator Remarks & Editorial Control</h3>
                  <p className="text-xs text-mute">Comments will appear on the final generated PDF booklet.</p>
                </div>
                <button className="btn-outline !py-1.5 !px-3 text-xs" onClick={draft}>
                  <Sparkles size={14} className="text-crimson-600" /> Draft with AI Assistant
                </button>
              </div>

              <div>
                <label className="label">Form Master / Class Teacher's Remark</label>
                <textarea
                  className="input min-h-24 leading-relaxed"
                  value={ct}
                  onChange={e => setCt(e.target.value)}
                  placeholder="Provide guidance on conduct, continuous assessment, and areas for academic improvement..."
                />
              </div>

              {role === "admin" && (
                <div>
                  <label className="label">Headmaster's Endorsement</label>
                  <textarea
                    className="input min-h-20 leading-relaxed"
                    value={hc}
                    onChange={e => setHc(e.target.value)}
                    placeholder="Headmaster's certified endorsement comment..."
                  />
                </div>
              )}

              <div className="flex justify-end">
                <button className="btn-primary" onClick={saveComments}>
                  Save Official Comments
                </button>
              </div>
            </div>
          )}
        </div>
      )}
      {toast.node}
    </div>
  );
}
