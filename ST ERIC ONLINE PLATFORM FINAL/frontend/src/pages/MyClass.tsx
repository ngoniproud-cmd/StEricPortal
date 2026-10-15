import { useState } from "react";
import { Link } from "react-router-dom";
import {
  BookOpen,
  Calendar,
  CheckCircle2,
  Clock,
  FileCheck2,
  GraduationCap,
  Layers,
  Plus,
  Trash2,
  Upload,
  UserCheck,
  UserPlus,
  Users,
} from "lucide-react";
import { api, upload } from "../lib/api";
import { useFetch } from "../lib/hooks";
import { Badge, Empty, ErrorNote, Field, PageHeader, Select, Spinner, useToast } from "../components/ui";
import { currentTerm, currentYear } from "../lib/zim";

type Student = { id: string; admission_no: string; name: string; gender: string | null; guardian: string | null };

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
const PERIODS = [1, 2, 3, 4, 5, 6, 7];

function AddStudentModal({ onClose, onAdded }: { onClose: () => void; onAdded: () => void }) {
  const [f, setF] = useState({ admission_no: "", first_name: "", last_name: "", gender: "M" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setErr("");
    try {
      await api("/my-class/students", { method: "POST", json: f });
      onAdded();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="card-static w-full max-w-md p-6 space-y-4 animate-fade-in">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h3 className="font-display text-lg font-bold text-navy-900">Add New Student</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 text-xl font-bold cursor-pointer">
            &times;
          </button>
        </div>
        <Field label="Admission Number">
          <input
            className="input"
            value={f.admission_no}
            onChange={e => setF({ ...f, admission_no: e.target.value })}
            placeholder="e.g. SE-2026-0050"
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="First Name">
            <input className="input" value={f.first_name} onChange={e => setF({ ...f, first_name: e.target.value })} />
          </Field>
          <Field label="Last Name">
            <input className="input" value={f.last_name} onChange={e => setF({ ...f, last_name: e.target.value })} />
          </Field>
        </div>
        <Field label="Gender">
          <select className="input" value={f.gender} onChange={e => setF({ ...f, gender: e.target.value })}>
            <option value="M">Male</option>
            <option value="F">Female</option>
          </select>
        </Field>
        <ErrorNote msg={err} />
        <div className="flex justify-end gap-3 pt-2">
          <button className="btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn-primary"
            onClick={submit}
            disabled={busy || !f.admission_no || !f.first_name || !f.last_name}
          >
            {busy ? "Adding..." : "Add Student"}
          </button>
        </div>
      </div>
    </div>
  );
}

function AddLessonModal({ classId, onClose, onAdded }: { classId: string; onClose: () => void; onAdded: () => void }) {
  const subjectsQ = useFetch("/subjects");
  const teachersQ = useFetch("/users?role=teacher");
  const [day, setDay] = useState(1);
  const [period, setPeriod] = useState(1);
  const [subjectId, setSubjectId] = useState("");
  const [teacherId, setTeacherId] = useState("");
  const [room, setRoom] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!subjectId || !teacherId) return;
    setBusy(true);
    setErr("");
    try {
      await api("/timetable", {
        method: "POST",
        json: {
          class_id: classId,
          subject_id: subjectId,
          teacher_id: teacherId,
          day: Number(day),
          period: Number(period),
          room: room.trim() || undefined,
        },
      });
      onAdded();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="card-static w-full max-w-md p-6 space-y-4 animate-fade-in">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h3 className="font-display text-lg font-bold text-navy-900">Add Lesson to Class Timetable</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 text-xl font-bold cursor-pointer">
            &times;
          </button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Day of Week">
            <select className="input" value={day} onChange={e => setDay(+e.target.value)}>
              {DAYS.map((d, i) => (
                <option key={i + 1} value={i + 1}>
                  {d}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Period Number">
            <select className="input" value={period} onChange={e => setPeriod(+e.target.value)}>
              {PERIODS.map(p => (
                <option key={p} value={p}>
                  Period {p}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="Subject">
          <select className="input" value={subjectId} onChange={e => setSubjectId(e.target.value)}>
            <option value="">Select subject...</option>
            {(subjectsQ.data ?? []).map((s: any) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.level}-Level)
              </option>
            ))}
          </select>
        </Field>
        <Field label="Teacher">
          <select className="input" value={teacherId} onChange={e => setTeacherId(e.target.value)}>
            <option value="">Select teacher...</option>
            {(teachersQ.data ?? []).map((t: any) => (
              <option key={t.id} value={t.id}>
                {t.full_name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Room (optional)">
          <input className="input" value={room} onChange={e => setRoom(e.target.value)} placeholder="e.g. Lab 2 / Room 14" />
        </Field>
        <ErrorNote msg={err} />
        <div className="flex justify-end gap-3 pt-2">
          <button className="btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn-primary" onClick={submit} disabled={busy || !subjectId || !teacherId}>
            {busy ? "Scheduling..." : "Save Lesson"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function MyClass() {
  const q = useFetch("/my-class");
  const toast = useToast();
  const [tab, setTab] = useState<"students" | "attendance" | "timetable" | "reports" | "rank">("students");
  const [showAdd, setShowAdd] = useState(false);
  const [showAddLesson, setShowAddLesson] = useState(false);
  const [term, setTerm] = useState(currentTerm());
  const [year, setYear] = useState(currentYear());

  const classId = q.data?.class?.id;

  // Attendance state
  const [attDate, setAttDate] = useState(() => new Date().toISOString().slice(0, 10));
  const attQ = useFetch(tab === "attendance" && classId ? `/attendance/class/${classId}?day=${attDate}` : null);
  const [registerRows, setRegisterRows] = useState<Record<string, string>>({});
  const [attBusy, setAttBusy] = useState(false);

  // Timetable state
  const ttQ = useFetch(tab === "timetable" && classId ? `/timetable/class/${classId}` : null);

  // Marks confirmation & report status
  const marksStatusQ = useFetch(tab === "reports" && classId ? `/my-class/marks-status?term=${term}&year=${year}` : null);
  const [publishing, setPublishing] = useState(false);

  // Rankings state
  const rankQ = useFetch(tab === "rank" && classId ? `/class-rank/${classId}?term=${term}&year=${year}` : null);

  async function importFile(file: File) {
    const fd = new FormData();
    fd.append("file", file);
    try {
      const r = await upload("/students/import", fd);
      toast.show(`${r.created} students imported.${r.errors?.length ? ` ${r.errors.length} errors.` : ""}`);
      q.reload();
    } catch (e) {
      toast.show((e as Error).message);
    }
  }

  // Attendance handlers
  function setStatus(studentId: string, status: string) {
    setRegisterRows(prev => ({ ...prev, [studentId]: status }));
  }

  function markAllPresent() {
    const students: Student[] = q.data?.students ?? [];
    const allP: Record<string, string> = {};
    students.forEach(s => {
      allP[s.id] = "present";
    });
    setRegisterRows(allP);
  }

  async function saveRegister() {
    if (!classId) return;
    setAttBusy(true);
    const students: Student[] = q.data?.students ?? [];
    const payload = students.map(s => ({
      student_id: s.id,
      status: registerRows[s.id] || "present",
    }));

    try {
      await api(`/attendance/class/${classId}?day=${attDate}`, {
        method: "PUT",
        json: payload,
      });
      toast.show("Attendance register saved successfully.");
      attQ.reload();
    } catch (e) {
      toast.show((e as Error).message);
    } finally {
      setAttBusy(false);
    }
  }

  // Delete timetable slot
  async function deleteSlot(slotId: string) {
    if (!confirm("Remove this lesson from the class timetable?")) return;
    try {
      await api(`/timetable/${slotId}`, { method: "DELETE" });
      toast.show("Lesson removed.");
      ttQ.reload();
    } catch (e) {
      toast.show((e as Error).message);
    }
  }

  // Publish report cards
  async function publishReports() {
    if (!classId) return;
    if (!confirm(`Release final Term ${term} report cards for ${q.data.class.name}?`)) return;
    setPublishing(true);
    try {
      const res = await api("/reports/publish", {
        method: "POST",
        json: { class_id: classId, term, year },
      });
      toast.show(`Success: Term ${term} reports published for ${res.published} learners.`);
      marksStatusQ.reload();
    } catch (e) {
      toast.show((e as Error).message);
    } finally {
      setPublishing(false);
    }
  }

  if (q.loading) return <Spinner />;
  if (!q.data?.class)
    return (
      <div className="mx-auto max-w-3xl page-enter">
        <PageHeader eyebrow="Class Teacher" title="My Class" />
        <Empty title="No class assigned" hint="Ask the headmaster or HOD to assign you as class teacher of a class." />
      </div>
    );

  const klass = q.data.class;
  const students: Student[] = q.data.students ?? [];

  return (
    <div className="mx-auto max-w-5xl page-enter pb-16 space-y-6">
      {showAdd && (
        <AddStudentModal
          onClose={() => setShowAdd(false)}
          onAdded={() => {
            setShowAdd(false);
            q.reload();
            toast.show("Student added.");
          }}
        />
      )}

      {showAddLesson && (
        <AddLessonModal
          classId={klass.id}
          onClose={() => setShowAddLesson(false)}
          onAdded={() => {
            setShowAddLesson(false);
            ttQ.reload();
            toast.show("Lesson scheduled.");
          }}
        />
      )}

      <PageHeader
        eyebrow="Class Teacher Workspace"
        title={`Class ${klass.name}`}
        sub={`Form ${klass.form} · Academic Year ${klass.year} · ${students.length} Learners`}
      >
        <Link to="/teaching-classes" className="btn-outline text-xs flex items-center gap-1.5">
          <BookOpen size={14} /> Other Classes I Teach
        </Link>
        <button className="btn-primary text-xs" onClick={() => setShowAdd(true)}>
          <UserPlus size={14} /> Add Student
        </button>
        <label className="btn-outline text-xs cursor-pointer">
          <Upload size={14} /> Import List
          <input
            type="file"
            hidden
            accept=".xlsx,.csv"
            onChange={e => e.target.files?.[0] && importFile(e.target.files[0])}
          />
        </label>
      </PageHeader>

      {/* Class Metric Highlights */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="card-static bg-white p-5 border-l-4 border-l-navy-700">
          <p className="label">Class Enrollment</p>
          <p className="font-display text-3xl font-black text-navy-900">{students.length}</p>
          <p className="text-xs text-mute mt-1">Official Class Roster</p>
        </div>
        <div className="card-static bg-white p-5 border-l-4 border-l-crimson-600">
          <p className="label">Gender Distribution</p>
          <p className="font-display text-2xl font-black text-navy-900">
            {students.filter(s => s.gender === "M").length}M / {students.filter(s => s.gender === "F").length}F
          </p>
          <p className="text-xs text-mute mt-1">Male to Female learners</p>
        </div>
        <div className="card-static bg-white p-5 border-l-4 border-l-emerald-600">
          <p className="label">Evaluation Session</p>
          <p className="font-display text-2xl font-black text-navy-900">Term {term} · {year}</p>
          <p className="text-xs text-mute mt-1">Active Academic Term</p>
        </div>
      </div>

      {/* Workspace Navigation Tabs */}
      <div className="bg-white p-1 rounded-xl border border-slate-200 flex gap-1 overflow-x-auto shadow-2xs">
        {[
          { id: "students", label: "Class Roster", icon: Users },
          { id: "attendance", label: "Daily Register", icon: UserCheck },
          { id: "timetable", label: "Class Timetable", icon: Clock },
          { id: "reports", label: "Marks Confirmation & Reports", icon: FileCheck2 },
          { id: "rank", label: "End-of-Term Rankings", icon: GraduationCap },
        ].map(t => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id as any)}
              className={`shrink-0 px-4 py-2.5 rounded-lg text-xs font-bold transition-all duration-150 cursor-pointer flex items-center gap-2 ${
                tab === t.id
                  ? "bg-navy-900 text-white shadow-2xs"
                  : "text-slate-600 hover:text-navy-900 hover:bg-slate-50"
              }`}
            >
              <Icon size={15} className={tab === t.id ? "text-crimson-400" : "text-slate-400"} />
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: CLASS ROSTER */}
      {tab === "students" && (
        students.length === 0 ? (
          <Empty title="No students in this class" hint="Add students or import an Excel/CSV roster using the buttons above." />
        ) : (
          <div className="card-static bg-white border border-slate-200 overflow-hidden shadow-2xs">
            <div className="border-b border-slate-100 p-4 bg-slate-50/50 flex items-center justify-between">
              <div>
                <h3 className="font-display text-sm font-bold text-navy-900">Class {klass.name} Learner List</h3>
                <p className="text-xs text-slate-500">Learner information only. Fee balances are confidential.</p>
              </div>
              <span className="text-xs font-bold text-navy-700 bg-navy-50 px-2.5 py-1 rounded-md border border-navy-100">
                {students.length} Learners
              </span>
            </div>
            <table className="w-full text-sm">
              <thead className="border-b border-navy-900 bg-navy-900 text-xs font-bold uppercase tracking-wider text-white">
                <tr>
                  <th className="px-5 py-3 text-left w-12">#</th>
                  <th className="px-5 py-3 text-left">Full Name</th>
                  <th className="px-5 py-3 text-left">Reg. Number</th>
                  <th className="px-5 py-3 text-left">Gender</th>
                  <th className="px-5 py-3 text-left">Guardian</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {students.map((s, i) => (
                  <tr key={s.id} className={i % 2 === 0 ? "bg-white" : "bg-slate-50/40"}>
                    <td className="px-5 py-3 text-mute text-xs font-mono">{i + 1}</td>
                    <td className="px-5 py-3 font-bold text-navy-900">{s.name}</td>
                    <td className="px-5 py-3 font-mono text-xs text-slate-600">{s.admission_no}</td>
                    <td className="px-5 py-3">
                      <Badge tone={s.gender === "M" ? "navy" : "crimson"}>
                        {s.gender === "M" ? "Male" : s.gender === "F" ? "Female" : "—"}
                      </Badge>
                    </td>
                    <td className="px-5 py-3 text-sm text-slate-600">
                      {s.guardian ?? <span className="text-mute text-xs">Not linked</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {/* TAB 2: DAILY REGISTER (ATTENDANCE) */}
      {tab === "attendance" && (
        <div className="space-y-4">
          <div className="card-static bg-white p-5 border border-slate-200 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Field label="Register Date">
                <input
                  type="date"
                  className="input !w-44 text-sm"
                  value={attDate}
                  onChange={e => setAttDate(e.target.value)}
                />
              </Field>
              <button
                type="button"
                onClick={markAllPresent}
                className="btn-outline text-xs mt-5 cursor-pointer"
              >
                Mark All Present
              </button>
            </div>
            <button
              onClick={saveRegister}
              disabled={attBusy || students.length === 0}
              className="btn-primary text-xs mt-3 sm:mt-0"
            >
              <UserCheck size={14} /> {attBusy ? "Saving..." : "Save Daily Register"}
            </button>
          </div>

          {attQ.loading ? (
            <Spinner />
          ) : students.length === 0 ? (
            <Empty title="No learners to mark" hint="Add students to your class first." />
          ) : (
            <div className="card-static bg-white border border-slate-200 overflow-hidden shadow-2xs">
              <table className="w-full text-sm">
                <thead className="bg-navy-900 text-white text-xs font-bold uppercase tracking-wider">
                  <tr>
                    <th className="px-5 py-3 text-left w-12">#</th>
                    <th className="px-5 py-3 text-left">Learner</th>
                    <th className="px-5 py-3 text-left">Reg No</th>
                    <th className="px-5 py-3 text-right">Attendance Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {students.map((s, i) => {
                    const current = registerRows[s.id] || "present";
                    return (
                      <tr key={s.id} className={i % 2 === 0 ? "bg-white" : "bg-slate-50/40"}>
                        <td className="px-5 py-3 text-mute text-xs font-mono">{i + 1}</td>
                        <td className="px-5 py-3 font-bold text-navy-900">{s.name}</td>
                        <td className="px-5 py-3 font-mono text-xs text-slate-600">{s.admission_no}</td>
                        <td className="px-5 py-3 text-right">
                          <div className="inline-flex gap-1 bg-slate-100 p-1 rounded-lg">
                            {(["present", "absent", "late", "excused"] as const).map(st => {
                              const active = current === st;
                              return (
                                <button
                                  key={st}
                                  type="button"
                                  onClick={() => setStatus(s.id, st)}
                                  className={`px-3 py-1 rounded text-xs font-bold capitalize transition-all cursor-pointer ${
                                    active
                                      ? st === "present"
                                        ? "bg-emerald-600 text-white shadow-xs"
                                        : st === "absent"
                                        ? "bg-crimson-600 text-white shadow-xs"
                                        : st === "late"
                                        ? "bg-amber-500 text-white shadow-xs"
                                        : "bg-navy-700 text-white shadow-xs"
                                      : "text-slate-600 hover:text-navy-900"
                                  }`}
                                >
                                  {st}
                                </button>
                              );
                            })}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: CLASS TIMETABLE */}
      {tab === "timetable" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-mute">
              Manage weekly subject periods and teacher allocations for Class {klass.name}.
            </p>
            <button className="btn-primary text-xs" onClick={() => setShowAddLesson(true)}>
              <Plus size={14} /> Add Lesson Slot
            </button>
          </div>

          {ttQ.loading ? (
            <Spinner />
          ) : !ttQ.data || ttQ.data.length === 0 ? (
            <Empty
              title="Timetable Not Yet Scheduled"
              hint="Click 'Add Lesson Slot' above to create periods for your class."
            />
          ) : (
            <div className="card-static bg-white border border-slate-200 overflow-x-auto shadow-2xs">
              <table className="w-full text-sm">
                <thead className="bg-navy-900 text-white text-xs font-bold uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-3 text-left w-28">Day</th>
                    <th className="px-4 py-3 text-left w-24">Period</th>
                    <th className="px-5 py-3 text-left">Subject</th>
                    <th className="px-5 py-3 text-left">Teacher</th>
                    <th className="px-4 py-3 text-left">Room</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {ttQ.data.map((slot: any) => (
                    <tr key={slot.id} className="hover:bg-slate-50/50 transition">
                      <td className="px-4 py-3 font-bold text-navy-900">{DAYS[slot.day - 1] ?? `Day ${slot.day}`}</td>
                      <td className="px-4 py-3 text-xs font-semibold text-slate-600">Period {slot.period}</td>
                      <td className="px-5 py-3 font-bold text-navy-900">{slot.subject}</td>
                      <td className="px-5 py-3 text-xs text-slate-700">{slot.teacher ?? "—"}</td>
                      <td className="px-4 py-3 text-xs text-slate-500">{slot.room ?? "Classroom"}</td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => deleteSlot(slot.id)}
                          className="text-slate-400 hover:text-crimson-600 transition cursor-pointer p-1"
                          title="Delete Lesson"
                        >
                          <Trash2 size={15} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: MARKS CONFIRMATION & REPORT CARDS */}
      {tab === "reports" && (
        <div className="space-y-6">
          <div className="card-static bg-white p-6 border border-slate-200">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-5">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-crimson-600">
                  Final Student Report Verification
                </span>
                <h3 className="font-display text-lg font-bold text-navy-900 mt-0.5">
                  Subject Teacher Upload Checklist (Term {term}, {year})
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Confirm individual subject teachers have uploaded marks before authorizing report cards.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <select className="input !w-28 text-sm" value={term} onChange={e => setTerm(+e.target.value)}>
                  {[1, 2, 3].map(t => (
                    <option key={t} value={t}>
                      Term {t}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  className="input !w-24 text-sm"
                  value={year}
                  onChange={e => setYear(+e.target.value)}
                />
              </div>
            </div>

            {marksStatusQ.loading ? (
              <Spinner />
            ) : !marksStatusQ.data ? (
              <p className="text-sm text-mute pt-4">No marks data found.</p>
            ) : (
              <div className="pt-5 space-y-6">
                {/* Status Callout Banner */}
                <div
                  className={`p-4 rounded-xl border flex items-center justify-between gap-4 ${
                    marksStatusQ.data.all_confirmed
                      ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                      : "bg-amber-50 border-amber-200 text-amber-900"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <CheckCircle2
                      size={24}
                      className={marksStatusQ.data.all_confirmed ? "text-emerald-600" : "text-amber-600"}
                    />
                    <div>
                      <p className="text-sm font-bold">
                        {marksStatusQ.data.all_confirmed
                          ? "All Subject Teachers Have Uploaded Marks — Class Positions Calculated"
                          : "Pending Subject Marks Upload"}
                      </p>
                      <p className="text-xs opacity-90 mt-0.5">
                        {marksStatusQ.data.all_confirmed
                          ? "You can now publish final report cards so eligible students and parents can view results."
                          : "Some subject teachers are yet to submit final marks for this class."}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={publishReports}
                    disabled={publishing || marksStatusQ.data.is_published}
                    className={`btn text-xs font-bold px-4 py-2 rounded-lg text-white shadow-xs cursor-pointer ${
                      marksStatusQ.data.is_published
                        ? "bg-emerald-700 opacity-90"
                        : "bg-crimson-600 hover:bg-crimson-700"
                    }`}
                  >
                    {marksStatusQ.data.is_published
                      ? "Reports Already Released"
                      : publishing
                      ? "Publishing..."
                      : "Authorize & Release Reports"}
                  </button>
                </div>

                {/* Subject Checklist Table */}
                <div className="card-static overflow-hidden border border-slate-200">
                  <table className="w-full text-sm">
                    <thead className="bg-navy-900 text-white text-xs font-bold uppercase tracking-wider">
                      <tr>
                        <th className="px-5 py-3 text-left">Subject</th>
                        <th className="px-5 py-3 text-left">Assigned Subject Teacher</th>
                        <th className="px-4 py-3 text-center">Revision Tests</th>
                        <th className="px-4 py-3 text-center">Exam Marks Uploaded</th>
                        <th className="px-4 py-3 text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {(marksStatusQ.data.subjects ?? []).map((sub: any, i: number) => (
                        <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-slate-50/40"}>
                          <td className="px-5 py-3 font-bold text-navy-900">{sub.subject_name}</td>
                          <td className="px-5 py-3 text-xs text-slate-700">{sub.teacher_name}</td>
                          <td className="px-4 py-3 text-center text-xs font-semibold text-slate-600">
                            {sub.tests_count} {sub.tests_count === 1 ? "Test" : "Tests"}
                          </td>
                          <td className="px-4 py-3 text-center text-xs font-mono font-bold text-navy-900">
                            {sub.marks_entered} / {sub.total_students}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <Badge tone={sub.is_complete ? "green" : "amber"}>
                              {sub.is_complete ? "Uploaded" : "Pending"}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 5: END-OF-TERM RANKINGS */}
      {tab === "rank" && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <select className="input !w-28 text-sm" value={term} onChange={e => setTerm(+e.target.value)}>
              {[1, 2, 3].map(t => (
                <option key={t} value={t}>
                  Term {t}
                </option>
              ))}
            </select>
            <input
              className="input !w-24 text-sm"
              type="number"
              value={year}
              onChange={e => setYear(+e.target.value)}
            />
          </div>

          {rankQ.loading ? (
            <Spinner />
          ) : !rankQ.data || (rankQ.data.students ?? []).length === 0 ? (
            <Empty
              title="No marks available"
              hint="Subject teachers need to upload exam marks before rankings can be generated."
            />
          ) : (
            <div className="card-static bg-white border border-slate-200 overflow-x-auto shadow-2xs">
              <table className="w-full text-sm">
                <thead className="border-b border-navy-900 bg-navy-900 text-xs font-bold uppercase tracking-wider text-white">
                  <tr>
                    <th className="px-4 py-3 text-left w-16">Rank</th>
                    <th className="px-4 py-3 text-left">Learner Name</th>
                    <th className="px-4 py-3 text-left">Reg No</th>
                    {(rankQ.data.subjects ?? []).map((s: string) => (
                      <th key={s} className="px-3 py-3 text-center whitespace-nowrap">
                        {s}
                      </th>
                    ))}
                    <th className="px-4 py-3 text-center">Class Average</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(rankQ.data.students ?? []).map((s: any) => (
                    <tr
                      key={s.student_id}
                      className={s.rank === 1 ? "bg-amber-50/60" : s.rank <= 3 ? "bg-navy-50/30" : "bg-white"}
                    >
                      <td className="px-4 py-3">
                        <span
                          className={`inline-grid h-7 w-7 place-items-center rounded-full text-xs font-black ${
                            s.rank === 1
                              ? "bg-amber-500 text-white shadow-xs"
                              : s.rank === 2
                              ? "bg-slate-400 text-white shadow-xs"
                              : s.rank === 3
                              ? "bg-amber-700 text-white shadow-xs"
                              : "bg-slate-100 text-slate-700"
                          }`}
                        >
                          {s.rank}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-bold text-navy-900">{s.name}</td>
                      <td className="px-4 py-3 font-mono text-xs text-mute">{s.admission_no}</td>
                      {(rankQ.data.subjects ?? []).map((subj: string) => {
                        const sub = s.subjects?.[subj];
                        return (
                          <td key={subj} className="px-3 py-3 text-center">
                            {sub ? (
                              <span
                                className={`font-bold text-xs ${
                                  sub.pct >= 70
                                    ? "text-emerald-700"
                                    : sub.pct >= 50
                                    ? "text-navy-700"
                                    : "text-crimson-600"
                                }`}
                              >
                                {sub.pct}%<br />
                                <span className="font-mono text-[10px] text-mute">{sub.grade}</span>
                              </span>
                            ) : (
                              <span className="text-mute text-xs">—</span>
                            )}
                          </td>
                        );
                      })}
                      <td className="px-4 py-3 text-center font-black text-navy-900">
                        {s.overall != null ? `${s.overall}%` : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
      {toast.node}
    </div>
  );
}
