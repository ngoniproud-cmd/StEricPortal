import { useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  GraduationCap,
  Layers,
  PenLine,
  Plus,
  Save,
  Search,
  Sparkles,
  Users,
} from "lucide-react";
import { api } from "../lib/api";
import { useFetch } from "../lib/hooks";
import { Badge, Empty, ErrorNote, Field, PageHeader, Select, Spinner, useToast } from "../components/ui";
import { currentTerm, currentYear } from "../lib/zim";

type TeachingAssignment = {
  class_id: string;
  class_name: string;
  form: number;
  subject_id: string;
  subject: string;
};

export default function SubjectClasses() {
  const dashQ = useFetch("/dashboard");
  const toast = useToast();

  const myClassId = dashQ.data?.my_class?.id;
  const allTeaching: TeachingAssignment[] = dashQ.data?.teaching ?? [];

  // Filter out the teacher's own class-teacher class, or allow viewing all teaching classes
  const otherClasses = allTeaching.filter(t => t.class_id !== myClassId);
  const displayClasses = otherClasses.length > 0 ? otherClasses : allTeaching;

  const [selectedIdx, setSelectedIdx] = useState(0);
  const [activeSubTab, setActiveSubTab] = useState<"marks" | "students">("marks");
  const [searchTerm, setSearchTerm] = useState("");

  const selectedClass = displayClasses[selectedIdx] ?? displayClasses[0];

  // Fetch assessments for the selected class and subject
  const assessQ = useFetch(
    selectedClass ? `/assessments?term=${currentTerm()}&year=${currentYear()}` : null
  );

  // Fetch students for the selected class
  const studentsQ = useFetch(
    selectedClass ? `/classes/${selectedClass.class_id}/students` : null
  );

  // Mark entry modal state
  const [activeAssessmentId, setActiveAssessmentId] = useState<string | null>(null);
  const sheetQ = useFetch(activeAssessmentId ? `/assessments/${activeAssessmentId}/sheet` : null);
  const [sheetRows, setSheetRows] = useState<any[]>([]);
  const [savingMarks, setSavingMarks] = useState(false);

  // New assessment modal state
  const [showNewModal, setShowNewModal] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newKind, setNewKind] = useState("test");
  const [newMaxMarks, setNewMaxMarks] = useState(50);
  const [newTerm, setNewTerm] = useState(currentTerm());
  const [newYear, setNewYear] = useState(currentYear());
  const [creatingBusy, setCreatingBusy] = useState(false);
  const [createErr, setCreateErr] = useState("");

  // When sheet data loads, sync to sheetRows
  const assessmentMeta = sheetQ.data?.assessment;
  const loadedRows = sheetQ.data?.rows;

  function openMarkSheet(assessmentId: string) {
    setActiveAssessmentId(assessmentId);
    setSheetRows([]);
  }

  function handleMarkChange(studentId: string, val: string) {
    if (val === "") {
      setSheetRows(prev => {
        const existing = prev.length > 0 ? [...prev] : [...(loadedRows || [])];
        return existing.map(r => (r.student_id === studentId ? { ...r, marks_obtained: null, grade: null } : r));
      });
      return;
    }
    const raw = Number(val);
    if (isNaN(raw)) return;
    const max = assessmentMeta?.max_marks || 100;
    if (max > 0 && raw > max) {
      toast.show(`Mark cannot exceed maximum total of ${max}.`);
    }
    const num = max > 0 ? Math.min(Math.max(raw, 0), max) : Math.max(raw, 0);

    setSheetRows(prev => {
      const existing = prev.length > 0 ? [...prev] : [...(loadedRows || [])];
      return existing.map(r => {
        if (r.student_id === studentId) {
          let grade = r.grade;
          if (num != null && max > 0) {
            const pct = (num / max) * 100;
            grade = pct >= 80 ? "A" : pct >= 70 ? "B" : pct >= 50 ? "C" : pct >= 40 ? "D" : pct >= 30 ? "E" : "U";
          }
          return { ...r, marks_obtained: num, grade };
        }
        return r;
      });
    });
  }

  function handleAbsentToggle(studentId: string, absent: boolean) {
    setSheetRows(prev => {
      const existing = prev.length > 0 ? [...prev] : [...(loadedRows || [])];
      return existing.map(r => {
        if (r.student_id === studentId) {
          return { ...r, absent, marks_obtained: absent ? null : r.marks_obtained };
        }
        return r;
      });
    });
  }

  async function saveMarks() {
    if (!activeAssessmentId) return;
    setSavingMarks(true);
    const rowsToSave = sheetRows.length > 0 ? sheetRows : (loadedRows || []);
    const payload = rowsToSave.map((r: any) => ({
      student_id: r.student_id,
      marks_obtained: r.absent ? null : r.marks_obtained,
      absent: r.absent,
    }));

    try {
      await api(`/assessments/${activeAssessmentId}/marks`, {
        method: "PUT",
        json: { rows: payload, marks: payload },
      });
      toast.show("Marks saved successfully.");
      sheetQ.reload();
      assessQ.reload();
      setActiveAssessmentId(null);
    } catch (e) {
      toast.show((e as Error).message);
    } finally {
      setSavingMarks(false);
    }
  }

  async function handleCreateAssessment() {
    if (!selectedClass || !newTitle) return;
    setCreatingBusy(true);
    setCreateErr("");
    try {
      await api("/assessments", {
        method: "POST",
        json: {
          class_id: selectedClass.class_id,
          subject_id: selectedClass.subject_id,
          title: newTitle.trim(),
          kind: newKind,
          term: Number(newTerm),
          year: Number(newYear),
          max_marks: Number(newMaxMarks),
          weight: newKind.startsWith("exam") ? 2.0 : 1.0,
        },
      });
      toast.show("Assessment created. You can now enter marks.");
      setShowNewModal(false);
      setNewTitle("");
      assessQ.reload();
    } catch (e) {
      setCreateErr((e as Error).message);
    } finally {
      setCreatingBusy(false);
    }
  }

  if (dashQ.loading) return <Spinner />;

  // Filter assessments for the selected class and subject
  const currentAssessments = (assessQ.data ?? []).filter(
    (a: any) => a.class === selectedClass?.class_name && a.subject === selectedClass?.subject
  );

  const studentsList = (studentsQ.data ?? []).filter((s: any) =>
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.admission_no.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="mx-auto max-w-5xl page-enter pb-16 space-y-6">
      {/* Create Assessment Modal */}
      {showNewModal && selectedClass && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="card-static w-full max-w-md p-6 space-y-4 animate-fade-in">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-display text-lg font-bold text-navy-900">Create Assessment</h3>
                <p className="text-xs text-mute mt-0.5">
                  Class {selectedClass.class_name} · {selectedClass.subject}
                </p>
              </div>
              <button
                onClick={() => setShowNewModal(false)}
                className="text-slate-400 hover:text-slate-700 text-xl font-bold cursor-pointer"
              >
                &times;
              </button>
            </div>

            <Field label="Assessment Category / Type">
              <select className="input" value={newKind} onChange={e => setNewKind(e.target.value)}>
                <option value="test">Weekly Revision Test</option>
                <option value="assignment">Assignment / Coursework</option>
                <option value="exam">End of Term Examination (Paper 1)</option>
                <option value="exam2">End of Term Examination (Paper 2)</option>
                <option value="exam3">End of Term Practical / Oral</option>
              </select>
            </Field>

            <Field label="Assessment Title">
              <input
                className="input"
                value={newTitle}
                onChange={e => setNewTitle(e.target.value)}
                placeholder="e.g. Week 4 Revision Test or Paper 1 Exam"
              />
            </Field>

            <div className="grid grid-cols-3 gap-3">
              <Field label="Term">
                <select className="input" value={newTerm} onChange={e => setNewTerm(+e.target.value)}>
                  {[1, 2, 3].map(t => (
                    <option key={t} value={t}>Term {t}</option>
                  ))}
                </select>
              </Field>
              <Field label="Year">
                <input
                  type="number"
                  className="input"
                  value={newYear}
                  onChange={e => setNewYear(+e.target.value)}
                />
              </Field>
              <Field label="Max Marks">
                <input
                  type="number"
                  className="input"
                  min={1}
                  value={newMaxMarks}
                  onChange={e => setNewMaxMarks(+e.target.value)}
                />
              </Field>
            </div>

            <ErrorNote msg={createErr} />

            <div className="flex justify-end gap-3 pt-2">
              <button className="btn-ghost" onClick={() => setShowNewModal(false)}>
                Cancel
              </button>
              <button
                className="btn-primary"
                onClick={handleCreateAssessment}
                disabled={creatingBusy || !newTitle.trim()}
              >
                {creatingBusy ? "Creating..." : "Create Assessment"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mark Entry Sheet Modal */}
      {activeAssessmentId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="card-static w-full max-w-3xl max-h-[90vh] flex flex-col p-6 animate-fade-in">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-crimson-600">
                  {assessmentMeta?.kind?.startsWith("exam") ? "End of Term Exam" : "Revision Test"}
                </span>
                <h3 className="font-display text-lg font-bold text-navy-900">
                  {assessmentMeta?.title || "Enter Marks"}
                </h3>
                <p className="text-xs text-mute mt-0.5">
                  Class {assessmentMeta?.class} · {assessmentMeta?.subject} · Out of {assessmentMeta?.max_marks} marks
                </p>
              </div>
              <button
                onClick={() => setActiveAssessmentId(null)}
                className="text-slate-400 hover:text-slate-700 text-xl font-bold cursor-pointer"
              >
                &times;
              </button>
            </div>

            {sheetQ.loading ? (
              <div className="py-16"><Spinner /></div>
            ) : (
              <div className="flex-1 overflow-y-auto my-4 border border-slate-200 rounded-lg">
                <table className="w-full text-sm">
                  <thead className="bg-navy-900 text-white text-xs font-bold uppercase tracking-wider sticky top-0">
                    <tr>
                      <th className="px-4 py-3 text-left w-12">#</th>
                      <th className="px-4 py-3 text-left">Learner Name</th>
                      <th className="px-4 py-3 text-left">Reg No</th>
                      <th className="px-4 py-3 text-center w-32">Marks (/{assessmentMeta?.max_marks})</th>
                      <th className="px-4 py-3 text-center w-24">Grade</th>
                      <th className="px-4 py-3 text-center w-20">Absent</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(sheetRows.length > 0 ? sheetRows : (loadedRows || [])).map((r: any, i: number) => (
                      <tr key={r.student_id} className={i % 2 === 0 ? "bg-white" : "bg-slate-50/40"}>
                        <td className="px-4 py-2.5 text-xs text-mute font-mono">{i + 1}</td>
                        <td className="px-4 py-2.5 font-bold text-navy-900">{r.name}</td>
                        <td className="px-4 py-2.5 font-mono text-xs text-slate-500">{r.admission_no}</td>
                        <td className="px-4 py-2.5 text-center">
                          <input
                            type="number"
                            min={0}
                            max={assessmentMeta?.max_marks || 100}
                            disabled={r.absent}
                            value={r.marks_obtained != null ? r.marks_obtained : ""}
                            onChange={e => handleMarkChange(r.student_id, e.target.value)}
                            placeholder="—"
                            className="input !w-20 text-center font-bold text-navy-900 py-1"
                          />
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          <span className={`inline-grid h-7 w-7 place-items-center rounded-full text-xs font-black ${
                            !r.grade ? "bg-slate-100 text-mute" :
                            r.grade === "A" ? "bg-emerald-100 text-emerald-800" :
                            r.grade === "U" ? "bg-red-100 text-red-800" : "bg-navy-100 text-navy-800"
                          }`}>
                            {r.absent ? "ABS" : r.grade ?? "—"}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          <input
                            type="checkbox"
                            checked={Boolean(r.absent)}
                            onChange={e => handleAbsentToggle(r.student_id, e.target.checked)}
                            className="rounded border-slate-300 text-crimson-600 focus:ring-crimson-500"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex justify-between items-center pt-3 border-t border-slate-100">
              <span className="text-xs text-mute">
                {(sheetRows.length > 0 ? sheetRows : (loadedRows || [])).length} students in marksheet
              </span>
              <div className="flex gap-2">
                <button className="btn-ghost text-xs" onClick={() => setActiveAssessmentId(null)}>
                  Close
                </button>
                <button className="btn-primary text-xs" onClick={saveMarks} disabled={savingMarks}>
                  <Save size={14} /> {savingMarks ? "Saving..." : "Save Marks"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Header */}
      <PageHeader
        eyebrow="Subject Teaching Allocation"
        title="Other Classes I Teach"
        sub="View entire student class lists and enter marks for weekly revision tests and end-of-term examinations for all other classes you teach."
      >
        <Link to="/my-class" className="btn-outline text-xs">
          <GraduationCap size={14} /> View My Assigned Class ({dashQ.data?.my_class?.name || "My Class"})
        </Link>
      </PageHeader>

      {/* If teacher has no other teaching assignments */}
      {displayClasses.length === 0 ? (
        <Empty
          title="No other teaching classes assigned"
          hint="You are currently only assigned to your class teacher class, or your HOD has not yet allocated additional subject classes."
        />
      ) : (
        <div className="space-y-6">
          {/* Class & Subject Selector Horizontal Bar */}
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-mute mb-2">
              Select Teaching Class & Subject:
            </p>
            <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              {displayClasses.map((item, idx) => {
                const isSelected = idx === selectedIdx;
                const isALevel = item.form >= 5;
                return (
                  <button
                    key={`${item.class_id}-${item.subject_id}`}
                    onClick={() => {
                      setSelectedIdx(idx);
                      setActiveAssessmentId(null);
                    }}
                    className={`card-static p-4 text-left transition-all duration-150 cursor-pointer border-2 ${
                      isSelected
                        ? "border-navy-700 bg-white shadow-md ring-2 ring-navy-100"
                        : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-xs"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-1">
                      <span className="font-display text-base font-bold text-navy-900">
                        Class {item.class_name}
                      </span>
                      <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-navy-50 text-navy-700">
                        Form {item.form}
                      </span>
                    </div>
                    <p className="text-xs font-semibold text-crimson-600 mt-1">{item.subject}</p>
                    <p className="text-[11px] text-mute mt-2">
                      {isALevel ? "ZIMSEC A-Level" : "ZIMSEC O-Level"}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Active Class Header & Sub-Tabs */}
          {selectedClass && (
            <div className="card-static bg-white border border-slate-200 p-6 space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-5">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-display text-2xl font-black text-navy-900">
                      Class {selectedClass.class_name}
                    </span>
                    <span className="h-4 w-px bg-slate-300" />
                    <span className="text-base font-bold text-crimson-600">
                      {selectedClass.subject}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Form {selectedClass.form} · Academic Year 2026 · {studentsQ.data?.length ?? 0} Students Enrolled
                  </p>
                </div>

                {/* Sub-Tab Toggle */}
                <div className="flex bg-slate-100 p-1 rounded-lg">
                  <button
                    onClick={() => setActiveSubTab("marks")}
                    className={`px-4 py-2 rounded-md text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                      activeSubTab === "marks"
                        ? "bg-white text-navy-900 shadow-xs"
                        : "text-slate-600 hover:text-navy-900"
                    }`}
                  >
                    <ClipboardCheck size={14} /> Mark Entry (Tests & Exams)
                  </button>
                  <button
                    onClick={() => setActiveSubTab("students")}
                    className={`px-4 py-2 rounded-md text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                      activeSubTab === "students"
                        ? "bg-white text-navy-900 shadow-xs"
                        : "text-slate-600 hover:text-navy-900"
                    }`}
                  >
                    <Users size={14} /> Full Class Student List
                  </button>
                </div>
              </div>

              {/* SUB-TAB 1: MARK ENTRY (WEEKLY REVISION TESTS & EXAMINATIONS) */}
              {activeSubTab === "marks" && (
                <div className="space-y-6">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <h4 className="font-display text-base font-bold text-navy-900">
                        Assessments for {selectedClass.class_name} ({selectedClass.subject})
                      </h4>
                      <p className="text-xs text-mute">
                        Enter and record scores for weekly revision tests and end-of-term examinations.
                      </p>
                    </div>

                    <button
                      className="btn-primary text-xs"
                      onClick={() => {
                        setShowNewModal(true);
                        setCreateErr("");
                      }}
                    >
                      <Plus size={14} /> Create Assessment / Exam
                    </button>
                  </div>

                  {assessQ.loading ? (
                    <Spinner />
                  ) : currentAssessments.length === 0 ? (
                    <div className="rounded-xl border-2 border-dashed border-slate-200 p-8 text-center space-y-3">
                      <p className="font-display text-base font-bold text-navy-800">
                        No assessments created for this class yet
                      </p>
                      <p className="text-xs text-mute max-w-sm mx-auto">
                        Create your first Weekly Revision Test or End of Term Examination to begin entering marks for {selectedClass.class_name}.
                      </p>
                      <button
                        className="btn-primary text-xs"
                        onClick={() => setShowNewModal(true)}
                      >
                        <Plus size={14} /> Create First Assessment
                      </button>
                    </div>
                  ) : (
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      {currentAssessments.map((a: any) => {
                        const isExam = a.kind?.startsWith("exam");
                        const complete = a.entered === a.total && a.total > 0;
                        const pct = a.total ? Math.round((a.entered / a.total) * 100) : 0;
                        return (
                          <div
                            key={a.id}
                            className={`card-static p-5 border-t-4 flex flex-col justify-between ${
                              isExam ? "border-t-crimson-600" : "border-t-navy-700"
                            }`}
                          >
                            <div>
                              <div className="flex items-start justify-between gap-2">
                                <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                                  isExam ? "bg-crimson-50 text-crimson-700" : "bg-navy-50 text-navy-700"
                                }`}>
                                  {isExam ? "End of Term Exam" : "Revision Test"}
                                </span>
                                <Badge tone={complete ? "green" : "amber"}>
                                  {a.entered} / {a.total} Entered
                                </Badge>
                              </div>
                              <h5 className="font-display text-base font-bold text-navy-900 mt-2">
                                {a.title}
                              </h5>
                              <p className="text-xs text-mute mt-1">
                                Term {a.term} · {a.year} · Out of {a.max_marks} marks
                              </p>
                            </div>

                            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                              <span className="text-xs font-semibold text-slate-500">
                                Progress: <b className="text-navy-900">{pct}%</b>
                              </span>
                              <button
                                onClick={() => openMarkSheet(a.id)}
                                className="btn-primary text-xs py-1.5 px-3 flex items-center gap-1"
                              >
                                <PenLine size={12} /> Enter Marks
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* SUB-TAB 2: FULL CLASS STUDENT LIST */}
              {activeSubTab === "students" && (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="relative w-full max-w-xs">
                      <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Search student or reg number..."
                        className="input !pl-9 text-xs"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                      />
                    </div>
                    <span className="text-xs font-bold text-navy-700 bg-navy-50 px-3 py-1.5 rounded-lg border border-navy-100">
                      {studentsList.length} Learners in {selectedClass.class_name}
                    </span>
                  </div>

                  {studentsQ.loading ? (
                    <Spinner />
                  ) : studentsList.length === 0 ? (
                    <Empty title="No students found" hint="No active students in this class." />
                  ) : (
                    <div className="card-static overflow-hidden border border-slate-200">
                      <table className="w-full text-sm">
                        <thead className="bg-navy-900 text-white text-xs font-bold uppercase tracking-wider">
                          <tr>
                            <th className="px-5 py-3 text-left w-12">#</th>
                            <th className="px-5 py-3 text-left">Learner Name</th>
                            <th className="px-5 py-3 text-left">Admission / Reg No</th>
                            <th className="px-5 py-3 text-left">Gender</th>
                            <th className="px-5 py-3 text-right">Enrolled Subject</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {studentsList.map((s: any, i: number) => (
                            <tr key={s.id} className={i % 2 === 0 ? "bg-white" : "bg-slate-50/40"}>
                              <td className="px-5 py-3 text-mute text-xs font-mono">{i + 1}</td>
                              <td className="px-5 py-3 font-bold text-navy-900">{s.name}</td>
                              <td className="px-5 py-3 font-mono text-xs text-slate-600">{s.admission_no}</td>
                              <td className="px-5 py-3">
                                <Badge tone={s.gender === "M" ? "navy" : "crimson"}>
                                  {s.gender === "M" ? "Male" : s.gender === "F" ? "Female" : "—"}
                                </Badge>
                              </td>
                              <td className="px-5 py-3 text-right font-semibold text-slate-700 text-xs">
                                {selectedClass.subject}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
      {toast.node}
    </div>
  );
}
