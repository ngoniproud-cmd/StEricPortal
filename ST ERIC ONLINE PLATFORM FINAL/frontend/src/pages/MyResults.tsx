import { useMemo, useState } from "react";
import { Award, BookOpen, CheckCircle2, ChevronRight, FileCheck, FileSpreadsheet, FileText, Layers, Sparkles } from "lucide-react";
import { useFetch } from "../lib/hooks";
import { Badge, Empty, ErrorNote, PageHeader, Spinner } from "../components/ui";

type AssessmentItem = {
  student_id: string;
  student_name: string;
  subject: string;
  class: string;
  title: string;
  kind: string;
  is_mid_term: boolean;
  is_exam: boolean;
  category: string;
  term: number;
  year: number;
  is_current_term: boolean;
  marks: number | null;
  max: number;
  pct: number | null;
  grade: string | null;
  absent: boolean;
  date: string | null;
};

export default function MyResults() {
  const { data, loading, error } = useFetch("/assessments/my-results");
  const rawResults: AssessmentItem[] = (data as AssessmentItem[]) ?? [];

  // Active term toggle: current term (Term 3, 2026) vs previous term (Term 2, 2026)
  const [selectedTermKey, setSelectedTermKey] = useState<string>("current");
  const [activeDivision, setActiveDivision] = useState<"mid" | "exam">("mid");

  // Strict 2-term window: Term 3 2026 is current term, Term 2 2026 is previous term
  const termOptions = useMemo(() => {
    return [
      { key: "current", label: "Current Term", desc: "Term 3 · 2026", term: 3, year: 2026 },
      { key: "previous", label: "Previous Term", desc: "Term 2 · 2026", term: 2, year: 2026 },
    ];
  }, []);

  const activeOption = termOptions.find(o => o.key === selectedTermKey) ?? termOptions[0];

  // Filter results strictly to the selected term
  const filteredByTerm = useMemo(() => {
    return rawResults.filter(r => r.term === activeOption.term && r.year === activeOption.year);
  }, [rawResults, activeOption]);

  // Divide into Mid term Assessment vs End of Term exams
  const midTermItems = useMemo(() => {
    return filteredByTerm.filter(r => r.is_mid_term || r.kind === "test" || r.kind === "assignment" || !r.kind.startsWith("exam"));
  }, [filteredByTerm]);

  const endOfTermItems = useMemo(() => {
    return filteredByTerm.filter(r => r.is_exam || r.kind.startsWith("exam") || r.kind === "exam");
  }, [filteredByTerm]);

  // Group marks by Subject
  const groupSubjectPapers = (items: AssessmentItem[]) => {
    const map: Record<string, AssessmentItem[]> = {};
    items.forEach(item => {
      const s = item.subject || "General";
      if (!map[s]) map[s] = [];
      map[s].push(item);
    });
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b));
  };

  const midGrouped = useMemo(() => groupSubjectPapers(midTermItems), [midTermItems]);
  const examGrouped = useMemo(() => groupSubjectPapers(endOfTermItems), [endOfTermItems]);

  // Compute Term Average
  const activeItems = activeDivision === "mid" ? midTermItems : endOfTermItems;
  const validScores = activeItems.filter(r => r.pct !== null && !r.absent).map(r => r.pct as number);
  const termAvg = validScores.length ? Math.round(validScores.reduce((a, b) => a + b, 0) / validScores.length) : null;

  return (
    <div className="mx-auto max-w-5xl page-enter pb-16">
      <PageHeader
        eyebrow="Continuous Assessment & Examinations"
        title="Assessments"
        sub="Verified student marks per subject per paper. Displays active marks for the current term (Term 3 2026) and previous term (Term 2 2026) only. Older historical marks automatically archived."
      />

      {/* Term Window Control Strip */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-navy-200 bg-white p-3.5 sm:p-4 shadow-sm">
        <div>
          <p className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-mute">Active Academic Window:</p>
          <div className="mt-1 flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-navy-100 px-2.5 py-1 text-[11px] sm:text-xs font-black text-navy-900">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              Showing Current (Term 3) & Previous (Term 2) Only
            </span>
          </div>
          <p className="text-[11px] text-mute mt-1">
            Historical marks older than Term 2 2026 are automatically archived.
          </p>
        </div>

        {/* Term Switcher */}
        <div className="flex rounded-lg bg-navy-50 p-1 border border-navy-200 w-full sm:w-auto">
          {termOptions.map(opt => {
            const isSelected = selectedTermKey === opt.key;
            return (
              <button
                key={opt.key}
                onClick={() => setSelectedTermKey(opt.key)}
                className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 sm:gap-2 rounded-md px-3 sm:px-4 py-2 text-xs font-bold transition-all cursor-pointer ${
                  isSelected
                    ? "bg-navy-800 text-white shadow-sm"
                    : "text-navy-700 hover:text-navy-900 hover:bg-navy-100"
                }`}
              >
                <span>{opt.label}</span>
                <span className={`text-[10px] rounded px-1.5 py-0.2 ${isSelected ? "bg-white/20 text-white" : "bg-navy-200 text-navy-800"}`}>
                  {opt.desc}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {loading ? (
        <Spinner />
      ) : error ? (
        <ErrorNote msg={error} />
      ) : (
        <div className="space-y-6">
          {/* Main Assessment Division Sub-Tabs: Mid term Assessment vs End of Term exams */}
          <div className="card-static overflow-hidden border border-navy-200">
            <div className="grid grid-cols-1 sm:grid-cols-2 border-b border-line bg-navy-50/60 p-1.5 gap-1.5">
              <button
                onClick={() => setActiveDivision("mid")}
                className={`flex flex-col items-center justify-center rounded-lg py-2.5 sm:py-3.5 px-3 sm:px-4 text-center transition-all cursor-pointer ${
                  activeDivision === "mid"
                    ? "bg-white text-navy-900 shadow-sm border-2 border-navy-700 font-extrabold"
                    : "text-slate-600 hover:text-navy-900 hover:bg-white/50 font-semibold"
                }`}
              >
                <div className="flex items-center gap-2">
                  <FileSpreadsheet size={16} className={activeDivision === "mid" ? "text-navy-700" : "text-slate-400"} />
                  <span className="font-display text-sm sm:text-base">Mid Term Assessment</span>
                </div>
                <span className="text-[10px] sm:text-[11px] text-mute mt-0.5">
                  Revision Tests & Continuous Assessments ({midTermItems.length} papers)
                </span>
              </button>

              <button
                onClick={() => setActiveDivision("exam")}
                className={`flex flex-col items-center justify-center rounded-lg py-2.5 sm:py-3.5 px-3 sm:px-4 text-center transition-all cursor-pointer ${
                  activeDivision === "exam"
                    ? "bg-white text-crimson-800 shadow-sm border-2 border-crimson-600 font-extrabold"
                    : "text-slate-600 hover:text-navy-900 hover:bg-white/50 font-semibold"
                }`}
              >
                <div className="flex items-center gap-2">
                  <Award size={16} className={activeDivision === "exam" ? "text-crimson-600" : "text-slate-400"} />
                  <span className="font-display text-sm sm:text-base">End of Term Exams</span>
                </div>
                <span className="text-[10px] sm:text-[11px] text-mute mt-0.5">
                  Terminal Examinations: Paper 1, 2 & Practicals ({endOfTermItems.length} papers)
                </span>
              </button>
            </div>

            {/* Division Banner & Summary */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-white px-4 sm:px-6 py-3.5">
              <div>
                <h3 className="font-display text-base sm:text-lg font-bold text-navy-900">
                  {activeDivision === "mid" ? "Mid Term Assessment Papers" : "End of Term Examination Papers"}
                </h3>
                <p className="text-[11px] sm:text-xs text-mute mt-0.5">
                  {activeOption.desc} · Marks shown per subject per paper
                </p>
              </div>

              {termAvg !== null && (
                <div className="flex items-center gap-3 sm:gap-4 bg-navy-50 rounded-xl px-3 sm:px-4 py-1.5 sm:py-2 border border-navy-100">
                  <div>
                    <p className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-mute">Average</p>
                    <p className="font-display text-lg sm:text-xl font-black text-navy-900">{termAvg}%</p>
                  </div>
                  <div className="h-7 w-px bg-navy-200" />
                  <div>
                    <p className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-mute">Graded</p>
                    <p className="font-display text-lg sm:text-xl font-black text-crimson-700">{validScores.length}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Content for active division */}
            {activeItems.length === 0 ? (
              <div className="p-8 sm:p-12 text-center">
                <Empty
                  title={`No ${activeDivision === "mid" ? "Mid Term Assessment" : "End of Term Exam"} Marks Uploaded`}
                  hint={`Your subject teachers have not uploaded marks for ${activeOption.desc} yet. Marks will appear automatically once entered.`}
                />
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {(activeDivision === "mid" ? midGrouped : examGrouped).map(([subjectName, papers]) => {
                  return (
                    <div key={subjectName} className="p-3.5 sm:p-6 hover:bg-slate-50/50 transition">
                      {/* Subject Header */}
                      <div className="flex items-center justify-between pb-2 sm:pb-3 mb-2 sm:mb-3 border-b border-slate-100">
                        <div className="flex items-center gap-2">
                          <BookOpen size={16} className="text-navy-700 shrink-0" />
                          <h4 className="font-display text-sm sm:text-base font-bold text-navy-900">{subjectName}</h4>
                          <span className="text-[10px] sm:text-[11px] font-medium text-mute">({papers.length} {papers.length === 1 ? "paper" : "papers"})</span>
                        </div>
                      </div>

                      {/* Papers Table with mobile touch-scroll container */}
                      <div className="overflow-x-auto rounded-lg border border-line bg-white shadow-2xs">
                        <table className="w-full text-left text-xs sm:text-sm">
                          <thead className="bg-navy-900 text-white text-[11px] sm:text-xs font-semibold uppercase tracking-wider">
                            <tr>
                              <th className="px-3 sm:px-5 py-2.5 min-w-[140px]">Paper / Component</th>
                              <th className="px-2.5 sm:px-4 py-2.5 text-center min-w-[100px]">Marks Obtained</th>
                              <th className="px-2 sm:px-4 py-2.5 text-center min-w-[70px]">Score (%)</th>
                              <th className="px-2 sm:px-4 py-2.5 text-center min-w-[65px]">Grade</th>
                              <th className="px-2.5 sm:px-4 py-2.5 text-center min-w-[90px] hidden xs:table-cell">Term Date</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-line">
                            {papers.map((p, pIdx) => {
                              const isPass = (p.pct ?? 0) >= 50;
                              return (
                                <tr key={pIdx} className="hover:bg-navy-50/30 transition">
                                  <td className="px-3 sm:px-5 py-2.5 sm:py-3 font-semibold text-navy-900">
                                    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                                      <span className="truncate">{p.title}</span>
                                      <span className="w-fit text-[9px] sm:text-[10px] font-bold uppercase px-1.5 py-0.2 rounded bg-slate-100 text-slate-600">
                                        {p.kind}
                                      </span>
                                    </div>
                                  </td>

                                  <td className="px-2.5 sm:px-4 py-2.5 sm:py-3 text-center font-mono font-bold text-navy-900">
                                    {p.absent ? (
                                      <span className="text-xs text-crimson-600 font-bold">Absent</span>
                                    ) : p.marks !== null ? (
                                      <span>{p.marks} <span className="text-mute font-normal text-[11px]">/ {p.max}</span></span>
                                    ) : (
                                      <span className="text-mute">—</span>
                                    )}
                                  </td>

                                  <td className="px-2 sm:px-4 py-2.5 sm:py-3 text-center">
                                    {p.absent ? (
                                      <span className="text-xs text-mute font-mono">—</span>
                                    ) : p.pct !== null ? (
                                      <span className={`font-mono font-black ${isPass ? "text-navy-900" : "text-crimson-600"}`}>
                                        {p.pct}%
                                      </span>
                                    ) : (
                                      <span className="text-mute">—</span>
                                    )}
                                  </td>

                                  <td className="px-2 sm:px-4 py-2.5 sm:py-3 text-center">
                                    {p.absent ? (
                                      <span className="inline-grid h-6 w-6 sm:h-7 sm:w-7 place-items-center rounded-full text-[10px] sm:text-xs font-bold bg-slate-100 text-mute mx-auto">
                                        ABS
                                      </span>
                                    ) : p.grade ? (
                                      <span className={`inline-grid h-6 w-6 sm:h-7 sm:w-7 place-items-center rounded-full text-[10px] sm:text-xs font-black mx-auto ${
                                        p.grade === "A" ? "bg-emerald-100 text-emerald-800" :
                                        p.grade === "U" ? "bg-red-100 text-red-800" :
                                        "bg-navy-100 text-navy-800"
                                      }`}>
                                        {p.grade}
                                      </span>
                                    ) : (
                                      <span className="text-mute">—</span>
                                    )}
                                  </td>

                                  <td className="px-2.5 sm:px-4 py-2.5 sm:py-3 text-center text-[11px] font-mono text-mute hidden xs:table-cell">
                                    {p.date ? p.date : "Term 3"}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
