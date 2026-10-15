import { Link } from "react-router-dom";
import {
  ArrowRight,
  Award,
  BookOpen,
  ClipboardCheck,
  Clock,
  FileText,
  Megaphone,
  NotebookPen,
  Settings,
  Users,
  Wallet
} from "lucide-react";
import { useFetch } from "../lib/hooks";
import { Badge, Empty, ErrorNote, PageHeader, Spinner, Stat } from "../components/ui";

const Ring = ({ pct }: { pct: number | null }) => {
  const p = pct ?? 0, r = 26, c = 2 * Math.PI * r;
  return (
    <svg width="72" height="72" viewBox="0 0 72 72" role="img" aria-label={pct == null ? "No attendance yet" : `Attendance ${pct}%`}>
      <circle cx="36" cy="36" r={r} fill="none" stroke="#e2e8f0" strokeWidth="6" />
      <circle
        cx="36"
        cy="36"
        r={r}
        fill="none"
        stroke={p >= 80 ? "#10b981" : "#f59e0b"}
        strokeWidth="6"
        strokeLinecap="round"
        strokeDasharray={`${(p / 100) * c} ${c}`}
        transform="rotate(-90 36 36)"
      />
      <text x="36" y="41" textAnchor="middle" fontSize="13" fontWeight="800" fill="#0f172a">
        {pct == null ? "\u2013" : `${pct}%`}
      </text>
    </svg>
  );
};

const QuickLink = ({ to, icon: Icon, label, desc }: { to: string; icon: any; label: string; desc: string }) => (
  <Link
    to={to}
    className="group card flex items-center gap-4 p-5 transition-all duration-150 hover:-translate-y-0.5"
  >
    <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-navy-50 text-navy-700 transition group-hover:bg-navy-700 group-hover:text-white">
      <Icon size={20} />
    </div>
    <div className="min-w-0 flex-1">
      <p className="font-bold text-slate-900 text-sm group-hover:text-navy-700 transition">{label}</p>
      <p className="text-xs text-slate-500 mt-0.5">{desc}</p>
    </div>
    <ArrowRight size={16} className="shrink-0 text-slate-300 transition-transform group-hover:translate-x-1 group-hover:text-slate-600" />
  </Link>
);

function AdminChart({ url, title }: { url: string; title: string }) {
  const { data, loading, error } = useFetch(url);
  if (loading) return <div className="card-static p-6 h-48 flex items-center justify-center"><Spinner /></div>;
  if (error || !data) return <div className="card-static p-6 h-48 flex items-center justify-center text-xs text-mute">{title} — data unavailable</div>;

  // Enrollment by gender
  if (url.includes("enrollment-by-gender")) {
    const total = data.summary?.total ?? 1;
    const male = data.summary?.male ?? 0;
    const female = data.summary?.female ?? 0;
    const malePct = total ? Math.round((male / total) * 100) : 0;
    const femalePct = total ? Math.round((female / total) * 100) : 0;
    return (
      <div className="card-static p-6">
        <p className="label mb-4">{title}</p>
        <div className="flex items-center gap-6">
          <div className="relative flex-shrink-0">
            <svg width="100" height="100" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="40" fill="none" stroke="#e2e8f0" strokeWidth="14" />
              <circle cx="50" cy="50" r="40" fill="none" stroke="#1a3563" strokeWidth="14"
                strokeDasharray={`${malePct * 2.513} 251.3`} transform="rotate(-90 50 50)" strokeLinecap="round" />
              <circle cx="50" cy="50" r="40" fill="none" stroke="#c41e2a" strokeWidth="14"
                strokeDasharray={`${femalePct * 2.513} 251.3`}
                strokeDashoffset={`${-(malePct) * 2.513}`}
                transform="rotate(-90 50 50)" strokeLinecap="round" />
              <text x="50" y="54" textAnchor="middle" fontSize="14" fontWeight="800" fill="#0f172a">{total}</text>
            </svg>
          </div>
          <div className="flex-1 space-y-2.5">
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-sm bg-[#1a3563]" />
              <span className="text-xs font-semibold text-slate-700">Male</span>
              <span className="ml-auto text-xs font-black text-navy-900">{male} ({malePct}%)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-sm bg-[#c41e2a]" />
              <span className="text-xs font-semibold text-slate-700">Female</span>
              <span className="ml-auto text-xs font-black text-navy-900">{female} ({femalePct}%)</span>
            </div>
            <div className="pt-2 border-t border-slate-100">
              <p className="text-[10px] font-bold uppercase tracking-wider text-mute">By Form</p>
              {(data.by_form ?? []).map((f: any) => (
                <div key={f.form} className="flex items-center justify-between mt-1">
                  <span className="text-xs text-slate-600">Form {f.form}</span>
                  <span className="text-xs font-bold text-navy-900">{f.male}M / {f.female}F</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Fee collection line chart
  if (url.includes("fee-collection")) {
    const monthly = data.monthly ?? [];
    const maxVal = Math.max(...monthly.map((m: any) => Math.max(Number(m.collected) || 0, Number(m.outstanding) || 0)), 1);
    const W = 260, H = 120, padL = 10, padR = 10, padT = 10, padB = 30;
    const points = (key: string) => monthly.map((m: any, i: number) => {
      const val = Number(m[key]) || 0;
      const x = padL + (monthly.length > 1 ? (i / (monthly.length - 1)) * (W - padL - padR) : (W - padL - padR) / 2);
      const y = padT + (1 - val / maxVal) * (H - padT - padB);
      return `${x},${y}`;
    }).join(" ");
    const colStr = data.total_collected != null ? Number(data.total_collected).toFixed(0) : "0";
    const outStr = data.total_outstanding != null ? Number(data.total_outstanding).toFixed(0) : "0";
    return (
      <div className="card-static p-6">
        <p className="label mb-1">{title}</p>
        <div className="flex gap-4 text-[10px] font-bold mb-3">
          <span className="flex items-center gap-1"><span className="h-2 w-4 rounded-full bg-emerald-500 inline-block" />Collected: ${colStr}</span>
          <span className="flex items-center gap-1"><span className="h-2 w-4 rounded-full bg-crimson-500 inline-block" />Outstanding: ${outStr}</span>
        </div>
        {monthly.length > 0 ? (
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="none">
            <polyline points={points("collected")} fill="none" stroke="#10b981" strokeWidth="2" strokeLinejoin="round" />
            <polyline points={points("outstanding")} fill="none" stroke="#c41e2a" strokeWidth="2" strokeLinejoin="round" strokeDasharray="4 2" />
            {monthly.map((m: any, i: number) => {
              const x = padL + (monthly.length > 1 ? (i / (monthly.length - 1)) * (W - padL - padR) : (W - padL - padR) / 2);
              return <text key={i} x={x} y={H - 5} textAnchor="middle" fontSize="8" fill="#94a3b8">{m.month}</text>;
            })}
          </svg>
        ) : <p className="text-xs text-mute pt-4 text-center">No fee data recorded yet</p>}
      </div>
    );
  }

  // Academic performance by form (bar chart)
  if (url.includes("academic-performance")) {
    const forms = data.by_form ?? [];
    return (
      <div className="card-static p-6">
        <p className="label mb-4">{title}</p>
        {forms.length === 0 ? <p className="text-xs text-mute text-center pt-4">No marks recorded yet</p> : (
          <div className="space-y-3">
            {forms.map((f: any) => (
              <div key={f.form}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="font-bold text-navy-900">Form {f.form}</span>
                  <span className="font-black text-navy-900">{f.mean}%</span>
                </div>
                <div className="h-3 rounded-full bg-slate-100 overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${Math.min(f.mean || 0, 100)}%`, background: f.mean >= 70 ? '#10b981' : f.mean >= 50 ? '#1a3563' : '#c41e2a' }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Weekly attendance bar chart by gender
  if (url.includes("weekly-attendance")) {
    const days = Array.isArray(data) ? data : [];
    const maxVal = Math.max(...days.map((d: any) => Math.max(Number(d.male_total) || 0, Number(d.female_total) || 0)), 1);
    return (
      <div className="card-static p-6">
        <p className="label mb-1">{title}</p>
        <div className="flex gap-4 text-[10px] font-bold mb-3">
          <span className="flex items-center gap-1"><span className="h-2 w-3 rounded-sm bg-[#1a3563] inline-block" />Male</span>
          <span className="flex items-center gap-1"><span className="h-2 w-3 rounded-sm bg-[#c41e2a] inline-block" />Female</span>
        </div>
        {days.length === 0 ? <p className="text-xs text-mute text-center pt-4">No attendance data this week</p> : (
          <div className="flex items-end gap-2 h-28">
            {days.map((d: any, i: number) => {
              const mH = maxVal ? ((Number(d.male_present) || 0) / maxVal) * 96 : 0;
              const fH = maxVal ? ((Number(d.female_present) || 0) / maxVal) * 96 : 0;
              return (
                <div key={i} className="flex flex-1 flex-col items-center gap-1">
                  <div className="flex items-end gap-0.5 w-full justify-center" style={{ height: 96 }}>
                    <div className="w-3 rounded-t-sm bg-[#1a3563] transition-all" style={{ height: mH }} title={`Male: ${d.male_present ?? 0}`} />
                    <div className="w-3 rounded-t-sm bg-[#c41e2a] transition-all" style={{ height: fH }} title={`Female: ${d.female_present ?? 0}`} />
                  </div>
                  <span className="text-[9px] font-bold text-mute">{String(d.day ?? "").slice(0, 3)}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  return null;
}

export default function Dashboard() {
  const { data: d, loading, error } = useFetch("/dashboard");
  const teacher = d?.role === "teacher";
  const { data: todo } = useFetch(teacher ? "/assessments" : null);

  if (loading) return <Spinner />;
  if (error) return <ErrorNote msg={error} />;
  if (!d) return null;

  const marksRemaining = (todo ?? []).reduce((n: number, a: any) => n + (a.total - a.entered), 0);

  return (
    <div className="mx-auto max-w-5xl page-enter pb-16">
      <PageHeader
        eyebrow="Overview"
        title={`Welcome, ${d.name.split(" ")[0]}`}
        sub={d.unread ? `You have ${d.unread} unread notification${d.unread > 1 ? "s" : ""} in your inbox.` : undefined}
      />

      {/* Admin Dashboard */}
      {d.role === "admin" && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Stat label="Students" value={d.students} />
            <Stat label="Teachers" value={d.teachers} />
            <Stat
              label="Attendance Today"
              value={d.attendance_today == null ? "\u2013" : `${d.attendance_today}%`}
            />
            <Stat label="Pending Uploads" value={d.pending_uploads} />
            <Stat label="Published Reports" value={d.published_reports} />
          </div>

          <h2 className="mb-3 mt-8 text-sm font-bold text-navy-900">Quick Actions</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <QuickLink to="/setup" icon={Settings} label="School Setup" desc="Classes & teacher allocations" />
            <QuickLink to="/marks" icon={ClipboardCheck} label="Mark Entry" desc="Assessment marks" />
            <QuickLink to="/report-cards" icon={FileText} label="Report Cards" desc="Generate & publish" />
            <QuickLink to="/admin" icon={Users} label="People" desc="Students, parents & staff" />
          </div>

          {/* Analytics Charts Row */}
          <div className="mt-10">
            <h2 className="mb-4 text-sm font-bold text-navy-900">School Analytics</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <AdminChart url="/analytics/enrollment-by-gender" title="Enrollment by Gender" />
              <AdminChart url="/analytics/fee-collection" title="Fee Collection (USD)" />
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <AdminChart url="/analytics/academic-performance?term=3&year=2026" title="Academic Performance by Form (Term 3)" />
              <AdminChart url="/analytics/weekly-attendance" title="Weekly Attendance by Gender" />
            </div>
          </div>
        </>
      )}

      {/* HOD Dashboard */}
      {d.role === "hod" && (
        <>
          <div className="card-static mb-6 p-6 flex flex-wrap items-center justify-between gap-4">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-crimson-600">Head of Department</span>
              <h2 className="text-xl font-extrabold text-navy-900 mt-0.5">{d.department || "Academic"} Department</h2>
            </div>
            <Link to="/setup" className="btn-primary text-xs">
              <Settings size={14} /> Assign Classes
            </Link>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <Stat label="Teachers" value={d.dept_teachers ?? 0} />
            <Stat label="Classes" value={d.dept_classes ?? 0} />
            <Stat label="Subjects" value={d.dept_subjects ?? 0} />
          </div>

          <h2 className="mb-3 mt-8 text-sm font-bold text-navy-900">Quick Actions</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <QuickLink to="/setup" icon={Settings} label="Class Allocation" desc="Assign teachers to classes" />
            <QuickLink to="/marks" icon={ClipboardCheck} label="Mark Entry" desc="Review and enter marks" />
            <QuickLink to="/insights" icon={Users} label="Insights" desc="Learner tracking" />
            <QuickLink to="/report-cards" icon={FileText} label="Report Cards" desc="Term assessments" />
          </div>
        </>
      )}

      {/* Teacher Dashboard */}
      {teacher && (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <Stat label="My Classes" value={d.classes} />
            <Stat
              label="Marks Pending"
              value={marksRemaining}
              hint={marksRemaining === 0 ? "All caught up" : undefined}
            />
          </div>

          {/* Teacher's assigned class and subjects */}
          {d.my_class && (
            <div className="mt-8">
              <h2 className="mb-3 text-sm font-bold text-navy-900">My Class</h2>
              <div className="card-static p-5 border-l-4 border-l-crimson-600 flex items-center justify-between gap-4">
                <div>
                  <p className="font-display text-xl font-black text-navy-900">{d.my_class.name}</p>
                  <p className="text-xs text-mute mt-1">Form {d.my_class.form} · {d.my_class.students} learners · {d.my_class.year}</p>
                </div>
                <Link to="/my-class" className="btn-primary text-xs">Manage Class</Link>
              </div>
            </div>
          )}
          {(d.teaching ?? []).length > 0 && (
            <div className="mt-6">
              <h2 className="mb-3 text-sm font-bold text-navy-900">Teaching Assignments</h2>
              <div className="grid gap-2 sm:grid-cols-2">
                {(d.teaching ?? []).map((t: any, i: number) => (
                  <div key={i} className="card-static flex items-center gap-3 p-4">
                    <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-navy-100 text-navy-700 font-bold text-xs">
                      F{t.form}
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-sm text-navy-900 truncate">{t.subject}</p>
                      <p className="text-xs text-mute">{t.class_name}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <h2 className="mb-3 mt-8 text-sm font-bold text-navy-900">Mark Entry Progress</h2>
          {(todo ?? []).length === 0 ? (
            <Empty title="No assessments pending" />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {(todo ?? []).slice(0, 6).map((a: any) => (
                <Link
                  key={a.id}
                  to={`/marks?a=${a.id}`}
                  className="card p-5 transition-all duration-150 hover:-translate-y-0.5"
                >
                  <div className="flex justify-between gap-2">
                    <p className="font-bold text-sm text-navy-900">{a.subject}</p>
                    <Badge tone={a.entered === a.total ? "green" : "amber"}>
                      {a.entered}/{a.total}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">{a.class} · {a.title}</p>
                  <div className="mt-3 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className="h-full bg-navy-600 transition-all duration-300"
                      style={{ width: `${a.total ? (100 * a.entered) / a.total : 0}%` }}
                    />
                  </div>
                </Link>
              ))}
            </div>
          )}

          <h2 className="mb-3 mt-8 text-sm font-bold text-navy-900">Quick Actions</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <QuickLink to="/attendance" icon={ClipboardCheck} label="Attendance" desc="Mark today's register" />
            <QuickLink to="/library" icon={BookOpen} label="Library" desc="Upload materials" />
          </div>
        </>
      )}

      {/* Student / Parent Dashboard */}
      {(d.role === "student" || d.role === "parent") && (
        d.children?.length ? (
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              {d.children.map((k: any) => (
                <div key={k.id} className="card-static flex items-center gap-5 p-6">
                  <Ring pct={k.attendance} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-lg font-extrabold text-navy-900">{k.name}</p>
                      {k.fees_cleared === false ? (
                        <span className="inline-flex items-center rounded-md bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-800 border border-amber-200">
                          Fee Balance Due
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-800 border border-emerald-200">
                          Fees Cleared
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {k.class ?? "Unassigned"} · 30-day attendance
                    </p>
                    {k.fees_cleared === false ? (
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <Link
                          to="/fees"
                          className="inline-flex items-center gap-1 text-xs font-bold text-crimson-600 hover:underline"
                        >
                          Clear Fees with Bursar <ArrowRight size={13} />
                        </Link>
                        <span className="text-[11px] text-slate-400">· Results withheld</span>
                      </div>
                    ) : (
                      <Link
                        to="/report-cards"
                        className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-navy-700 hover:text-crimson-600 transition"
                      >
                        View Results <ArrowRight size={13} />
                      </Link>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div>
              <h2 className="mb-3 text-sm font-bold text-navy-900">Quick Access</h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <QuickLink to="/timetable" icon={Clock} label="Timetable" desc="Period times & venues" />
                <QuickLink to="/assignments" icon={NotebookPen} label="Homework" desc="Active tasks & submissions" />
                <QuickLink to="/report-cards" icon={FileText} label="Report Cards" desc="Official term results" />
                <QuickLink to="/library" icon={BookOpen} label="Library" desc="Textbooks & past papers" />
                <QuickLink to="/fees" icon={Wallet} label="Fees" desc="Statement & payments" />
                <QuickLink to="/announcements" icon={Megaphone} label="Announcements" desc="School news" />
              </div>
            </div>
          </div>
        ) : (
          <Empty
            title="No learner linked yet"
            hint="Ask the school office to link your account."
          />
        )
      )}

      {/* Form Academic Leaders (Staff Reference Only - Positioned at Bottom) */}
      {(d.role === "admin" || d.role === "teacher" || d.role === "hod") && (d.top_performers ?? []).length > 0 && (
        <div className="mt-12 pt-6 border-t border-slate-200">
          <div className="flex items-center gap-2 mb-3">
            <Award className="text-crimson-600" size={16} />
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Form Academic Leaders (Staff Reference)
            </h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {d.top_performers.map((tp: any) => (
              <div
                key={tp.form}
                className="card-static p-4 border-l-4 border-l-navy-700 flex items-center justify-between gap-3 shadow-2xs"
              >
                <div className="min-w-0">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-navy-700">
                    Form {tp.form} Rank 1
                  </span>
                  <p className="font-extrabold text-sm text-slate-900 truncate mt-0.5">{tp.student_name}</p>
                  <p className="text-xs text-slate-500 truncate font-medium">
                    {tp.class_name} · <span className="font-mono text-slate-400">{tp.admission_no}</span>
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-xl font-extrabold text-slate-900">{tp.overall}%</span>
                  <span className="block text-[10px] font-bold uppercase text-emerald-700">Average</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
