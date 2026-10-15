import { useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertCircle,
  BookOpen,
  CheckCircle2,
  Download,
  FileCheck2,
  FileSpreadsheet,
  FileText,
  Filter,
  GraduationCap,
  Layers,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload,
  UserCheck,
  UserPlus,
  Users,
} from "lucide-react";
import { api, session } from "../lib/api";
import { useFetch } from "../lib/hooks";
import { currentYear, fmtDate } from "../lib/zim";
import { Badge, ErrorNote, Field, PageHeader, Select, Spinner, useToast } from "../components/ui";

const DEPARTMENTS = [
  "Sciences",
  "Commercials",
  "Humanities",
  "Languages",
  "Practical Arts",
] as const;

function BulkImport() {
  const classesQ = useFetch("/classes");
  const [file, setFile] = useState<File | null>(null);
  const [importType, setImportType] = useState<"students" | "staff">("students");
  const [classId, setClassId] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [res, setRes] = useState<any>(null);
  const toast = useToast();

  async function handleUpload() {
    if (!file) return;
    setBusy(true);
    setErr("");
    setRes(null);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("import_type", importType);
    if (classId) fd.append("class_id", classId);

    try {
      const token = localStorage.getItem("token") || "";
      const r = await fetch("/api/v1/setup/bulk-import", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      const data = await r.json();
      if (!r.ok) {
        throw new Error(typeof data.detail === "string" ? data.detail : "Failed to process import file.");
      }
      setRes(data);
      toast.show(`Import completed: ${data.students_created || data.users_created} accounts provisioned.`);
      classesQ.reload();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function downloadTemplate() {
    const csvContent =
      "data:text/csv;charset=utf-8,First Name,Last Name,Gender,Class,Guardian Name,Guardian Phone\nTinashe,Moyo,M,1A,Mr. P. Moyo,+263771234567\nChipo,Sibanda,F,1A,Mrs. Sibanda,+263772345678\nFarai,Ncube,M,1B,Mr. P. Moyo,+263771234567\n";
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "st_eric_class_list_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  return (
    <div className="space-y-6">
      <div className="card-static bg-white border border-slate-200 p-6 sm:p-7 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-5">
          <div>
            <h3 className="font-display text-lg font-bold text-[#0d1f3d]">Import Class or Staff Lists</h3>
            <p className="text-xs text-slate-500 mt-1">
              Supports Excel (.xlsx, .xls), CSV, Word documents (.docx), and PDF rosters.
            </p>
          </div>
          <button
            type="button"
            onClick={downloadTemplate}
            className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 px-3.5 py-2 text-xs font-bold text-slate-700 transition"
          >
            <Download size={14} className="text-[#0d1f3d]" />
            Download Sample CSV
          </button>
        </div>

        <div className="mt-6 grid gap-5 sm:grid-cols-2">
          <Field label="Import Type">
            <Select value={importType} onChange={v => setImportType(v as any)}>
              <option value="students">Class List (Learners & Guardians)</option>
              <option value="staff">Staff List (Teachers & Administrative)</option>
            </Select>
          </Field>

          {importType === "students" && (
            <Field label="Target Class (Optional if defined in file)">
              <Select value={classId} onChange={v => setClassId(v)}>
                <option value="">Auto-assign from document or unassigned</option>
                {(classesQ.data ?? []).map((c: any) => (
                  <option key={c.id} value={c.id}>
                    {c.name} (Form {c.form} · {c.year})
                  </option>
                ))}
              </Select>
            </Field>
          )}

          <div className="sm:col-span-2">
            <label className="label mb-2 block">Upload Document File</label>
            <div className="relative rounded-xl border-2 border-dashed border-slate-300 bg-slate-50/60 p-6 text-center hover:bg-slate-50 transition">
              <input
                type="file"
                accept=".xlsx,.xls,.csv,.docx,.doc,.pdf"
                onChange={e => setFile(e.target.files?.[0] || null)}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <div className="flex flex-col items-center pointer-events-none">
                <div className="h-10 w-10 rounded-xl bg-white border border-slate-200 shadow-2xs flex items-center justify-center text-[#0d1f3d] mb-2">
                  <Upload size={20} />
                </div>
                {file ? (
                  <p className="text-sm font-bold text-[#0d1f3d] flex items-center gap-2">
                    <FileCheck2 size={16} className="text-emerald-600" />
                    {file.name} <span className="text-xs text-slate-400 font-normal">({(file.size / 1024).toFixed(1)} KB)</span>
                  </p>
                ) : (
                  <>
                    <p className="text-sm font-semibold text-slate-800">
                      Click to choose or drag & drop class roster file
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      Excel, Word, CSV, or PDF · Student & guardian accounts will be automatically created
                    </p>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        <ErrorNote msg={err} />

        <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between">
          <p className="text-xs text-slate-500">
            Initial passwords are set to the learner's surname in capital letters with forced first-login change.
          </p>
          <button
            onClick={handleUpload}
            disabled={!file || busy}
            className="btn-primary py-2.5 px-5 text-xs font-bold flex items-center gap-2"
          >
            <Upload size={15} />
            {busy ? "Processing Document..." : "Process & Import List"}
          </button>
        </div>
      </div>

      {res && (
        <div className="card-static bg-white border-2 border-emerald-300 p-6 space-y-4 animate-fade-in shadow-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-emerald-100 text-emerald-800 grid place-items-center shrink-0">
                <CheckCircle2 size={20} />
              </div>
              <div>
                <h4 className="font-display font-bold text-base text-emerald-950">Roster Processed Successfully</h4>
                <p className="text-xs text-emerald-800 font-medium">
                  {res.students_created || res.users_created} accounts created · {res.guardians_linked || 0} guardians linked
                </p>
              </div>
            </div>
            <Badge tone="green">Success</Badge>
          </div>

          {res.sample_accounts && res.sample_accounts.length > 0 && (
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-bold uppercase tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="p-3">Name</th>
                    <th className="p-3">{res.import_type === "staff" ? "Role" : "Class"}</th>
                    <th className="p-3">Username</th>
                    <th className="p-3">Temporary Password</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {res.sample_accounts.map((acc: any, i: number) => (
                    <tr key={i} className="hover:bg-slate-50/50">
                      <td className="p-3 font-semibold text-slate-900">{acc.name}</td>
                      <td className="p-3 text-slate-600">{acc.class || acc.role}</td>
                      <td className="p-3 font-mono font-bold text-[#0d1f3d]">@{acc.username}</td>
                      <td className="p-3 font-mono font-bold text-[#c41e2a]">{acc.initial_password}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {res.errors && res.errors.length > 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900 space-y-1">
              <p className="font-bold">Warnings during import:</p>
              {res.errors.map((warn: string, i: number) => (
                <p key={i}>• {warn}</p>
              ))}
            </div>
          )}
        </div>
      )}
      {toast.node}
    </div>
  );
}

function Classes() {
  const q = useFetch("/classes");
  const t = useFetch("/users?role=teacher");
  const [f, setF] = useState<any>({ year: currentYear(), form: "1" });
  const [err, setErr] = useState("");
  const [filterForm, setFilterForm] = useState<string>("all");
  const [initializing, setInitializing] = useState(false);
  const toast = useToast();
  const isHod = session.role() === "hod";

  async function add() {
    setErr("");
    try {
      await api("/classes", {
        method: "POST",
        json: { name: f.name, form: +f.form, year: +f.year, class_teacher_id: f.teacher || null },
      });
      setF({ ...f, name: "" });
      q.reload();
      toast.show("Class added successfully.");
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  async function initStandardClasses() {
    if (!confirm("Initialize standard St Eric High classes (Forms 1–4 streams A–H and A-Level streams)?")) {
      return;
    }
    setInitializing(true);
    setErr("");
    try {
      const r = await api("/setup/init-standard-classes", { method: "POST" });
      toast.show(`Standard classes initialized (${r.created} streams added).`);
      q.reload();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setInitializing(false);
    }
  }

  const allClasses: any[] = q.data ?? [];
  const filtered = filterForm === "all" ? allClasses : allClasses.filter(c => String(c.form) === filterForm);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
        <div className="flex items-center gap-1.5 overflow-x-auto">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider mr-2">Filter Form:</span>
          {["all", "1", "2", "3", "4", "5", "6"].map(fm => (
            <button
              key={fm}
              onClick={() => setFilterForm(fm)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                filterForm === fm
                  ? "bg-[#0d1f3d] text-white shadow-2xs"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              {fm === "all" ? "All Forms" : `Form ${fm}`}
            </button>
          ))}
        </div>

        {!isHod && (
          <button
            type="button"
            onClick={initStandardClasses}
            disabled={initializing}
            className="btn-primary text-xs py-2 px-3.5 font-bold flex items-center gap-1.5 shrink-0"
          >
            <GraduationCap size={15} />
            {initializing ? "Initializing..." : "Initialize Standard Streams (1A–4H & A-Level)"}
          </button>
        )}
      </div>

      {!isHod && (
        <div className="card-static bg-white p-5 border border-slate-200 shadow-2xs">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">Add Class Stream</h4>
          <div className="grid gap-3 sm:grid-cols-4">
            <Field label="Class Name">
              <input
                className="input"
                placeholder="e.g. 1A, 2B, or 5 Sciences A"
                value={f.name ?? ""}
                onChange={e => setF({ ...f, name: e.target.value })}
              />
            </Field>
            <Field label="Form">
              <Select value={f.form} onChange={v => setF({ ...f, form: v })}>
                {[1, 2, 3, 4, 5, 6].map(n => (
                  <option key={n} value={n}>Form {n}</option>
                ))}
              </Select>
            </Field>
            <Field label="Academic Year">
              <input
                type="number"
                className="input"
                value={f.year}
                onChange={e => setF({ ...f, year: e.target.value })}
              />
            </Field>
            <Field label="Class Teacher">
              <Select value={f.teacher} onChange={v => setF({ ...f, teacher: v })}>
                <option value="">Select teacher…</option>
                {(t.data ?? []).map((u: any) => (
                  <option key={u.id} value={u.id}>{u.full_name}</option>
                ))}
              </Select>
            </Field>
          </div>
          <div className="mt-3 flex items-center gap-3">
            <button className="btn-primary text-xs py-2 px-4" disabled={!f.name} onClick={add}>
              Add Class
            </button>
            <ErrorNote msg={err} />
          </div>
        </div>
      )}

      {q.loading ? (
        <Spinner />
      ) : (
        <div className="card-static bg-white border border-slate-200 overflow-hidden shadow-2xs">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-bold uppercase tracking-wider border-b border-slate-200">
              <tr>
                <th className="p-3.5">Class & Stream</th>
                <th className="p-3.5">Form / Level</th>
                <th className="p-3.5">Class Teacher</th>
                <th className="p-3.5">Enrolment</th>
                {!isHod && <th className="p-3.5 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((c: any) => (
                <tr key={c.id} className="hover:bg-slate-50/60 transition">
                  <td className="p-3.5 font-bold text-[#0d1f3d] text-sm">{c.name}</td>
                  <td className="p-3.5">
                    <Badge tone={c.form >= 5 ? "gold" : "navy"}>
                      Form {c.form} · {c.year}
                    </Badge>
                  </td>
                  <td className="p-3.5 text-slate-600 font-medium">
                    {c.teacher_name || <span className="text-slate-400 italic">Unassigned</span>}
                  </td>
                  <td className="p-3.5 text-slate-700 font-semibold">{c.students ?? 0} learners</td>
                  {!isHod && (
                    <td className="p-3.5 text-right">
                      <button
                        aria-label="Archive class"
                        className="p-1.5 text-slate-400 hover:text-red-700 rounded transition cursor-pointer"
                        onClick={() =>
                          confirm(`Archive class ${c.name}?`) &&
                          api(`/classes/${c.id}`, { method: "DELETE" }).then(q.reload).catch(e => setErr(e.message))
                        }
                      >
                        <Trash2 size={15} />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="p-8 text-center text-xs text-slate-400">No classes found for this form filter.</div>
          )}
        </div>
      )}
      {toast.node}
    </div>
  );
}

function Subjects() {
  const q = useFetch("/subjects");
  const [f, setF] = useState<any>({ level: "O", department: "Sciences" });
  const [filterDept, setFilterDept] = useState<string>("all");
  const [filterLevel, setFilterLevel] = useState<string>("all");
  const [err, setErr] = useState("");
  const toast = useToast();
  const isHod = session.role() === "hod";

  async function add() {
    setErr("");
    try {
      await api("/subjects", {
        method: "POST",
        json: { name: f.name, zimsec_code: f.code || null, level: f.level, department: f.department },
      });
      setF({ level: f.level, department: f.department });
      q.reload();
      toast.show("Subject added successfully.");
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  const allSubjects: any[] = q.data ?? [];
  const filtered = allSubjects.filter(s => {
    if (filterDept !== "all" && s.department !== filterDept) return false;
    if (filterLevel !== "all" && s.level !== filterLevel) return false;
    return true;
  });

  return (
    <div className="space-y-5">
      {/* Department Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
        <div className="flex items-center gap-1.5 overflow-x-auto">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider mr-1">Study Area:</span>
          {["all", ...DEPARTMENTS].map(dept => (
            <button
              key={dept}
              onClick={() => setFilterDept(dept)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                filterDept === dept
                  ? "bg-[#0d1f3d] text-white shadow-2xs"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              {dept === "all" ? "All Departments" : dept}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1">
          {["all", "O", "A"].map(lvl => (
            <button
              key={lvl}
              onClick={() => setFilterLevel(lvl)}
              className={`px-2.5 py-1 rounded text-xs font-bold transition cursor-pointer ${
                filterLevel === lvl
                  ? "bg-[#c41e2a] text-white"
                  : "border border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
            >
              {lvl === "all" ? "All Levels" : `${lvl}-Level`}
            </button>
          ))}
        </div>
      </div>

      {!isHod && (
        <div className="card-static bg-white p-5 border border-slate-200 shadow-2xs">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">Add Subject</h4>
          <div className="grid gap-3 sm:grid-cols-4">
            <Field label="Subject Name">
              <input
                className="input"
                value={f.name ?? ""}
                onChange={e => setF({ ...f, name: e.target.value })}
                placeholder="e.g. Mathematics"
              />
            </Field>
            <Field label="ZIMSEC Syllabus Code">
              <input
                className="input"
                value={f.code ?? ""}
                onChange={e => setF({ ...f, code: e.target.value })}
                placeholder="e.g. 4004"
              />
            </Field>
            <Field label="Academic Level">
              <Select value={f.level} onChange={v => setF({ ...f, level: v })}>
                <option value="O">O-Level (Form 1–4)</option>
                <option value="A">A-Level (Form 5–6)</option>
              </Select>
            </Field>
            <Field label="Department / Study">
              <Select value={f.department} onChange={v => setF({ ...f, department: v })}>
                {DEPARTMENTS.map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </Select>
            </Field>
          </div>
          <div className="mt-3 flex items-center gap-3">
            <button className="btn-primary text-xs py-2 px-4" disabled={!f.name} onClick={add}>
              Add Subject
            </button>
            <ErrorNote msg={err} />
          </div>
        </div>
      )}

      {q.loading ? (
        <Spinner />
      ) : (
        <div className="card-static bg-white border border-slate-200 overflow-hidden shadow-2xs">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-bold uppercase tracking-wider border-b border-slate-200">
              <tr>
                <th className="p-3.5">Subject</th>
                <th className="p-3.5">ZIMSEC Code</th>
                <th className="p-3.5">Level</th>
                <th className="p-3.5">Department</th>
                {!isHod && <th className="p-3.5 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((s: any) => (
                <tr key={s.id} className="hover:bg-slate-50/60 transition">
                  <td className="p-3.5 font-bold text-slate-900">{s.name}</td>
                  <td className="p-3.5 font-mono text-slate-600">{s.zimsec_code || "—"}</td>
                  <td className="p-3.5">
                    <Badge tone={s.level === "A" ? "gold" : "navy"}>{s.level === "A" ? "A-Level" : "O-Level"}</Badge>
                  </td>
                  <td className="p-3.5">
                    <span className="font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded text-[11px]">
                      {s.department || "General"}
                    </span>
                  </td>
                  {!isHod && (
                    <td className="p-3.5 text-right">
                      <button
                        aria-label="Archive subject"
                        className="p-1.5 text-slate-400 hover:text-red-700 rounded transition cursor-pointer"
                        onClick={() => confirm(`Archive ${s.name}?`) && api(`/subjects/${s.id}`, { method: "DELETE" }).then(q.reload)}
                      >
                        <Trash2 size={15} />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="p-8 text-center text-xs text-slate-400">No subjects found matching filters.</div>
          )}
        </div>
      )}
      {toast.node}
    </div>
  );
}

function Teaching() {
  const role = session.role();
  const isHod = role === "hod";
  const hodQ = useFetch(isHod ? "/hod/overview" : null);
  const q = useFetch("/teacher-assignments");
  const t = useFetch(isHod ? null : "/users?role=teacher");
  const c = useFetch(isHod ? null : "/classes");
  const s = useFetch(isHod ? null : "/subjects");

  const [f, setF] = useState<any>({});
  const [filterDept, setFilterDept] = useState<string>("all");
  const [err, setErr] = useState("");
  const toast = useToast();

  const hodData = hodQ.data;
  const teachersList = isHod ? (hodData?.teachers ?? []) : (t.data ?? []);
  const classesList = isHod ? (hodData?.classes ?? []) : (c.data ?? []);
  const subjectsList = isHod ? (hodData?.subjects ?? []) : (s.data ?? []);

  async function add() {
    setErr("");
    try {
      await api("/teacher-assignments", {
        method: "POST",
        json: { teacher_id: f.t, class_id: f.c, subject_id: f.s },
      });
      q.reload();
      if (isHod) hodQ.reload();
      toast.show("Teacher successfully assigned to class.");
      setF({});
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  const allAssignments: any[] = isHod ? (hodData?.assignments ?? q.data ?? []) : (q.data ?? []);
  const filteredAssignments = isHod
    ? allAssignments
    : filterDept === "all"
    ? allAssignments
    : allAssignments.filter(a => a.department === filterDept);

  return (
    <div className="space-y-5">
      {/* Department Context Banner */}
      {isHod ? (
        <div className="rounded-xl border border-slate-200 bg-gradient-to-r from-white via-slate-50 to-white p-5 shadow-2xs flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-[#c41e2a]">Head of Department</span>
              <span className="text-slate-300">·</span>
              <span className="text-xs font-bold text-[#0d1f3d]">{session.name()}</span>
            </div>
            <h3 className="text-lg font-black text-[#0d1f3d] font-display mt-0.5">
              {hodData?.department || "Department"} Allocation & Teaching Roster
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              You have {teachersList.length} teacher(s) in your study area. Assign them to any class stream for your curriculum subjects.
            </p>
          </div>
          <div className="flex gap-2">
            <span className="px-3 py-1.5 rounded-lg bg-navy-50 text-[#0d1f3d] text-xs font-bold border border-navy-200">
              {teachersList.length} Teachers
            </span>
            <span className="px-3 py-1.5 rounded-lg bg-amber-50 text-amber-900 text-xs font-bold border border-amber-200">
              {subjectsList.length} Subjects
            </span>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center gap-1.5 overflow-x-auto">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider mr-1">Study Department:</span>
            {["all", ...DEPARTMENTS].map(dept => (
              <button
                key={dept}
                onClick={() => setFilterDept(dept)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  filterDept === dept
                    ? "bg-[#0d1f3d] text-white shadow-2xs"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                {dept === "all" ? "All Departments" : dept}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Assignment Input Card */}
      <div className="card-static bg-white p-5 border border-slate-200 shadow-2xs">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
          {isHod ? `Assign ${hodData?.department || ""} Teacher to Class` : "Assign Subject Teacher to Class"}
        </h4>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Subject Teacher">
            <Select value={f.t} onChange={v => setF({ ...f, t: v })}>
              <option value="">Select Teacher…</option>
              {teachersList.map((x: any) => (
                <option key={x.id} value={x.id}>
                  {x.full_name || x.name} {x.department ? `(${x.department})` : ""}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Curriculum Subject">
            <Select value={f.s} onChange={v => setF({ ...f, s: v })}>
              <option value="">Select Subject…</option>
              {subjectsList.map((x: any) => (
                <option key={x.id} value={x.id}>
                  {x.name} ({x.level}-Level{x.zimsec_code ? ` · ${x.zimsec_code}` : ""})
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Target Class & Stream">
            <Select value={f.c} onChange={v => setF({ ...f, c: v })}>
              <option value="">Select Class…</option>
              {classesList.map((x: any) => (
                <option key={x.id} value={x.id}>
                  {x.name} (Form {x.form} · {x.year})
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <div className="mt-3 flex items-center gap-3">
          <button
            className="btn-primary text-xs py-2 px-4 font-bold flex items-center gap-1.5"
            disabled={!f.t || !f.c || !f.s}
            onClick={add}
          >
            <UserCheck size={14} />
            Assign Teacher to Class
          </button>
          <ErrorNote msg={err} />
        </div>
      </div>

      {/* Assignments Table */}
      {q.loading || (isHod && hodQ.loading) ? (
        <Spinner />
      ) : (
        <div className="card-static bg-white border border-slate-200 overflow-hidden shadow-2xs">
          <div className="bg-slate-50 px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200 flex justify-between">
            <span>Current Teaching Allocations</span>
            <span>{filteredAssignments.length} Assigned</span>
          </div>
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/50 text-slate-600 font-bold uppercase tracking-wider border-b border-slate-200">
              <tr>
                <th className="p-3.5">Teacher</th>
                <th className="p-3.5">Subject</th>
                <th className="p-3.5">Class Stream</th>
                <th className="p-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredAssignments.map((a: any) => (
                <tr key={a.id} className="hover:bg-slate-50/60 transition">
                  <td className="p-3.5 font-bold text-slate-900">{a.teacher}</td>
                  <td className="p-3.5 text-slate-700">
                    <span className="font-semibold">{a.subject}</span>
                    {a.department && (
                      <span className="ml-2 text-[10px] text-slate-400 uppercase font-mono">({a.department})</span>
                    )}
                  </td>
                  <td className="p-3.5 font-bold text-[#0d1f3d]">{a.class}</td>
                  <td className="p-3.5 text-right">
                    <button
                      aria-label="Remove assignment"
                      className="p-1.5 text-slate-400 hover:text-red-700 rounded transition cursor-pointer"
                      onClick={() =>
                        confirm(`Unassign ${a.teacher} from ${a.subject} in ${a.class}?`) &&
                        api(`/teacher-assignments/${a.id}`, { method: "DELETE" }).then(() => {
                          q.reload();
                          if (isHod) hodQ.reload();
                          toast.show("Allocation removed.");
                        })
                      }
                    >
                      <Trash2 size={15} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredAssignments.length === 0 && (
            <div className="p-8 text-center text-xs text-slate-400">No teaching allocations recorded yet.</div>
          )}
        </div>
      )}
      {toast.node}
    </div>
  );
}

function Grading() {
  const [level, setLevel] = useState("A");
  const q = useFetch(`/grading/${level}`);
  const [bands, setBands] = useState<any[] | null>(null);
  const [err, setErr] = useState("");
  const toast = useToast();

  const cur = bands ?? q.data?.bands;
  const setMin = (i: number, v: string) => {
    const b = (cur as any[]).map(x => ({ ...x }));
    b[i].min_pct = Number(v);
    if (b[i + 1]) b[i + 1].max_pct = Number(v) - 1;
    setBands(b);
  };

  async function save() {
    setErr("");
    try {
      const r = await api(`/grading/${level}`, { method: "PUT", json: cur });
      toast.show(r.note || "Grading boundaries saved.");
      setBands(null);
      q.reload();
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          {[["O", "O-Level (Forms 1–4)"], ["A", "A-Level (Forms 5–6)"]].map(([k, l]) => (
            <button
              key={k}
              onClick={() => { setLevel(k); setBands(null); }}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
                level === k ? "bg-[#0d1f3d] text-white shadow-2xs" : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              {l}
            </button>
          ))}
        </div>
        <span className="text-xs text-slate-500 font-medium">Standard ZIMSEC scale</span>
      </div>

      {!cur ? (
        <Spinner />
      ) : (
        <div className="card-static bg-white border border-slate-200 overflow-hidden shadow-2xs">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 font-bold uppercase tracking-wider text-slate-600 border-b border-slate-200">
              <tr>
                <th className="p-3.5">Grade</th>
                <th className="p-3.5">Minimum %</th>
                <th className="p-3.5">Maximum %</th>
                {level === "A" && <th className="p-3.5">Points</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {cur.map((b: any, i: number) => (
                <tr key={b.grade} className="hover:bg-slate-50/50">
                  <td className="p-3.5 text-base font-bold text-[#0d1f3d]">{b.grade}</td>
                  <td className="p-3.5">
                    {i === cur.length - 1 ? (
                      <span className="font-semibold text-slate-500">0</span>
                    ) : (
                      <input
                        type="number"
                        min={0}
                        max={100}
                        className="input !w-20 !py-1 text-xs font-bold"
                        value={b.min_pct}
                        onChange={e => setMin(i, e.target.value)}
                      />
                    )}
                  </td>
                  <td className="p-3.5 font-semibold text-slate-600">{b.max_pct}%</td>
                  {level === "A" && <td className="p-3.5 font-bold text-[#0d1f3d]">{b.points}</td>}
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex items-center gap-3 border-t border-slate-200 p-4 bg-slate-50/50">
            <button className="btn-primary text-xs py-2 px-4" onClick={save} disabled={!bands}>
              Save Boundaries
            </button>
            <ErrorNote msg={err} />
          </div>
        </div>
      )}
      {toast.node}
    </div>
  );
}

function Accounts() {
  const q = useFetch("/users");
  const [search, setSearch] = useState("");
  const toast = useToast();

  async function toggle(u: any) {
    try {
      await api(`/users/${u.id}/status`, {
        method: "PATCH",
        json: { status: u.status === "active" ? "inactive" : "active" },
      });
      q.reload();
      toast.show(`Account ${u.status === "active" ? "deactivated" : "activated"}.`);
    } catch (e) {
      toast.show((e as Error).message);
    }
  }

  async function reset(u: any) {
    if (!confirm(`Reset the password for ${u.full_name}?`)) return;
    try {
      const r = await api(`/users/${u.id}/reset-password`, { method: "POST" });
      alert(`Temporary password for @${u.username}: ${r.temporary_password}\n\nUser will be prompted to change password upon first sign-in.`);
    } catch (e) {
      toast.show((e as Error).message);
    }
  }

  const users: any[] = q.data ?? [];
  const filtered = users.filter(u =>
    u.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    u.username?.toLowerCase().includes(search.toLowerCase()) ||
    u.role?.toLowerCase().includes(search.toLowerCase()) ||
    u.department?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            className="input !pl-9 text-xs"
            placeholder="Search accounts by name, username, role or department..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <span className="text-xs text-slate-500 font-semibold">{filtered.length} total accounts</span>
      </div>

      {q.loading ? (
        <Spinner />
      ) : (
        <div className="card-static bg-white border border-slate-200 overflow-hidden shadow-2xs">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-bold uppercase tracking-wider border-b border-slate-200">
              <tr>
                <th className="p-3.5">User</th>
                <th className="p-3.5">Username</th>
                <th className="p-3.5">Role</th>
                <th className="p-3.5">Department</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((u: any) => (
                <tr key={u.id} className="hover:bg-slate-50/60 transition">
                  <td className="p-3.5">
                    <p className="font-bold text-[#0d1f3d]">{u.full_name}</p>
                    {u.phone && <p className="text-[11px] text-slate-400">{u.phone}</p>}
                  </td>
                  <td className="p-3.5 font-mono text-[#0d1f3d] font-semibold">@{u.username}</td>
                  <td className="p-3.5">
                    <Badge tone={u.role === "student" ? "navy" : u.role === "parent" ? "gold" : u.role === "hod" ? "crimson" : "green"}>
                      {u.role === "hod" ? "HOD" : u.role}
                    </Badge>
                  </td>
                  <td className="p-3.5 text-slate-600 font-semibold">
                    {u.department ? (
                      <span className="bg-slate-100 px-2 py-0.5 rounded text-[11px] text-slate-800">
                        {u.department}
                      </span>
                    ) : "—"}
                  </td>
                  <td className="p-3.5">
                    <span className={`inline-flex items-center gap-1 font-semibold ${u.status === "active" ? "text-emerald-700" : "text-slate-400"}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${u.status === "active" ? "bg-emerald-600" : "bg-slate-400"}`} />
                      {u.status}
                    </span>
                  </td>
                  <td className="p-3.5 text-right space-x-2">
                    <button
                      className="px-2.5 py-1 rounded border border-slate-200 text-slate-700 hover:bg-slate-50 font-semibold cursor-pointer"
                      onClick={() => reset(u)}
                    >
                      Reset Password
                    </button>
                    <button
                      className="px-2.5 py-1 rounded border border-slate-200 text-slate-700 hover:bg-slate-50 font-semibold cursor-pointer"
                      onClick={() => toggle(u)}
                    >
                      {u.status === "active" ? "Deactivate" : "Activate"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {toast.node}
    </div>
  );
}

function Audit() {
  const q = useFetch("/audit");
  return q.loading ? (
    <Spinner />
  ) : !(q.data ?? []).length ? (
    <p className="text-sm text-mute">No changes recorded yet.</p>
  ) : (
    <div className="card-static bg-white border border-slate-200 divide-y divide-slate-100 overflow-hidden shadow-2xs">
      {q.data.map((a: any, i: number) => (
        <div key={i} className="p-3.5 text-xs hover:bg-slate-50/50 transition">
          <div className="flex justify-between gap-2">
            <b className="text-[#0d1f3d]">{a.kind}</b>
            <span className="text-slate-400">{fmtDate(a.when)}</span>
          </div>
          <p className="mt-0.5 text-slate-700">{a.what}</p>
          <p className="text-slate-400 mt-0.5">By {a.who}{a.reason ? ` · ${a.reason}` : ""}</p>
        </div>
      ))}
    </div>
  );
}

function TeacherSetup() {
  const dashQ = useFetch("/dashboard");
  const d = dashQ.data;
  if (dashQ.loading) return <Spinner />;

  const myClass = d?.my_class;
  const teaching = d?.teaching ?? [];

  return (
    <div className="space-y-6">
      {/* Metric Highlights */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="card-static bg-white p-5 border-l-4 border-l-navy-700">
          <p className="label">Allocated Teaching Load</p>
          <p className="font-display text-3xl font-black text-navy-900">{teaching.length}</p>
          <p className="text-xs text-mute mt-1">Class & subject pairings</p>
        </div>
        <div className="card-static bg-white p-5 border-l-4 border-l-crimson-600">
          <p className="label">Class Teacher Allocation</p>
          <p className="font-display text-2xl font-black text-navy-900">
            {myClass ? myClass.name : "None"}
          </p>
          <p className="text-xs text-mute mt-1">
            {myClass ? `Form ${myClass.form} · ${myClass.students} registered learners` : "Assigned by Headmaster / HOD"}
          </p>
        </div>
        <div className="card-static bg-white p-5 border-l-4 border-l-emerald-600">
          <p className="label">Current Academic Session</p>
          <p className="font-display text-2xl font-black text-navy-900">2026 · Term 1</p>
          <p className="text-xs text-mute mt-1">ZIMSEC Standards Active</p>
        </div>
      </div>

      {/* Class Teacher Callout */}
      {myClass && (
        <div className="card-static bg-white p-6 border border-slate-200">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-crimson-600">
                Designated Class Teacher
              </span>
              <h3 className="font-display text-lg font-bold text-navy-900 mt-0.5">
                Class {myClass.name} (Form {myClass.form})
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                You have administrative authority over Class {myClass.name}. You manage the learner roster, write the weekly timetable, mark daily registers, confirm subject teacher mark uploads, and release final student reports.
              </p>
            </div>
            <Link to="/my-class" className="btn-primary text-xs flex items-center gap-1.5">
              <GraduationCap size={14} /> Open My Class Workspace
            </Link>
          </div>
          <div className="grid gap-3 sm:grid-cols-4 pt-4">
            <Link to="/my-class" className="rounded-lg bg-slate-50 p-3.5 hover:bg-navy-50 transition border border-slate-100 text-center">
              <p className="text-xs font-bold text-navy-900">Class Roster</p>
              <p className="text-[11px] text-mute mt-0.5">{myClass.students} Learners</p>
            </Link>
            <Link to="/my-class" className="rounded-lg bg-slate-50 p-3.5 hover:bg-navy-50 transition border border-slate-100 text-center">
              <p className="text-xs font-bold text-navy-900">Daily Register</p>
              <p className="text-[11px] text-mute mt-0.5">Attendance Tracker</p>
            </Link>
            <Link to="/my-class" className="rounded-lg bg-slate-50 p-3.5 hover:bg-navy-50 transition border border-slate-100 text-center">
              <p className="text-xs font-bold text-navy-900">Class Timetable</p>
              <p className="text-[11px] text-mute mt-0.5">Write & Edit Schedule</p>
            </Link>
            <Link to="/my-class" className="rounded-lg bg-slate-50 p-3.5 hover:bg-navy-50 transition border border-slate-100 text-center">
              <p className="text-xs font-bold text-navy-900">Rankings & Reports</p>
              <p className="text-[11px] text-mute mt-0.5">Authorize & Release</p>
            </Link>
          </div>
        </div>
      )}

      {/* Allocated Teaching Load */}
      <div className="card-static bg-white border border-slate-200 overflow-hidden shadow-2xs">
        <div className="border-b border-slate-100 p-5 bg-slate-50/50">
          <h3 className="font-display text-base font-bold text-navy-900">My Subject Teaching Load</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            All classes and subjects assigned to you by your Head of Department.
          </p>
        </div>
        {teaching.length === 0 ? (
          <div className="p-8 text-center text-sm text-mute">
            No subject teaching assignments allocated yet. Contact your HOD or Headmaster.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-navy-900 text-white text-xs font-bold uppercase tracking-wider">
              <tr>
                <th className="px-5 py-3 text-left">Class</th>
                <th className="px-5 py-3 text-left">Subject</th>
                <th className="px-5 py-3 text-left">Curriculum Level</th>
                <th className="px-5 py-3 text-right">Quick Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {teaching.map((t: any, i: number) => {
                const isALevel = t.form >= 5;
                return (
                  <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-slate-50/40"}>
                    <td className="px-5 py-3.5">
                      <span className="font-bold text-navy-900">{t.class_name}</span>
                      <span className="text-xs text-mute ml-2 font-semibold">Form {t.form}</span>
                    </td>
                    <td className="px-5 py-3.5 font-semibold text-slate-800">{t.subject}</td>
                    <td className="px-5 py-3.5">
                      <Badge tone={isALevel ? "crimson" : "navy"}>
                        {isALevel ? "ZIMSEC A-Level" : "ZIMSEC O-Level"}
                      </Badge>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <Link to="/marks" className="btn-outline text-xs py-1 px-3">
                        Enter Marks
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export default function Setup() {
  const role = session.role();
  const isHod = role === "hod";
  const isTeacher = role === "teacher";

  if (isTeacher) {
    return (
      <div className="mx-auto max-w-5xl page-enter space-y-6">
        <PageHeader
          eyebrow="Teacher Profile"
          title="Teaching Load & Allocations"
          sub="Overview of your assigned classes, subjects, and class teacher role."
        />
        <TeacherSetup />
      </div>
    );
  }

  const [tab, setTab] = useState<string>(isHod ? "teaching" : "import");

  const HOD_TABS = [
    { id: "teaching", label: "Department Teaching Allocation", icon: UserCheck },
    { id: "subjects", label: "Curriculum Subjects", icon: FileText },
    { id: "classes", label: "Class Rosters", icon: Layers },
  ];

  const ADMIN_TABS = [
    { id: "import", label: "Bulk Enrolment", icon: Upload },
    { id: "classes", label: "Classes & Streams", icon: Layers },
    { id: "subjects", label: "Subjects", icon: FileText },
    { id: "teaching", label: "Teaching Assignments", icon: UserCheck },
    { id: "grading", label: "Grading Boundaries", icon: GraduationCap },
    { id: "accounts", label: "User Accounts", icon: Users },
    { id: "audit", label: "Audit Trail", icon: ShieldCheck },
  ];

  const activeTabs = isHod ? HOD_TABS : ADMIN_TABS;

  const P: any = {
    import: BulkImport,
    classes: Classes,
    subjects: Subjects,
    teaching: Teaching,
    grading: Grading,
    accounts: Accounts,
    audit: Audit,
  }[tab] ?? (isHod ? Teaching : BulkImport);

  return (
    <div className="mx-auto max-w-5xl page-enter space-y-6">
      <PageHeader
        eyebrow={isHod ? "Department Head" : "Administration"}
        title={isHod ? "Department Allocation" : "School Setup"}
        sub={
          isHod
            ? "Allocate teachers to subjects and classes within your department."
            : "Configure school streams, curriculum, grading standards, and system accounts."
        }
      />
      <div className="bg-white p-1 rounded-xl border border-slate-200 flex gap-1 overflow-x-auto shadow-2xs">
        {activeTabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`shrink-0 px-3.5 py-2 rounded-lg text-xs font-bold transition-all duration-150 cursor-pointer flex items-center gap-2 ${
              tab === id
                ? "bg-[#0d1f3d] text-white shadow-2xs"
                : "text-slate-600 hover:text-[#0d1f3d] hover:bg-slate-50"
            }`}
          >
            <Icon size={14} className={tab === id ? "text-[#dba83a]" : "text-slate-400"} />
            <span>{label}</span>
          </button>
        ))}
      </div>
      <P />
    </div>
  );
}
