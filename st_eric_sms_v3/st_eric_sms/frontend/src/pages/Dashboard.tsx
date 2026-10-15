import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { useFetch } from "../lib/hooks";
import { Badge, Empty, ErrorNote, PageHeader, Spinner, Stat } from "../components/ui";

const Ring = ({ pct }: { pct: number | null }) => {
  const p = pct ?? 0, r = 26, c = 2 * Math.PI * r;
  return (<svg width="72" height="72" viewBox="0 0 72 72" role="img" aria-label={pct == null ? "No attendance yet" : `Attendance ${pct}%`}><circle cx="36" cy="36" r={r} fill="none" stroke="#e3e7ee" strokeWidth="7" />
    <circle cx="36" cy="36" r={r} fill="none" stroke={p >= 80 ? "#059669" : "#d97706"} strokeWidth="7" strokeLinecap="round" strokeDasharray={`${(p / 100) * c} ${c}`} transform="rotate(-90 36 36)" />
    <text x="36" y="40" textAnchor="middle" fontSize="14" fontWeight="600" fill="#12284c">{pct == null ? "–" : `${pct}%`}</text></svg>);
};

export default function Dashboard() {
  const { data: d, loading, error } = useFetch("/dashboard");
  const teacher = d?.role === "teacher";
  const { data: todo } = useFetch(teacher ? "/assessments" : null);
  if (loading) return <Spinner />; if (error) return <ErrorNote msg={error} />; if (!d) return null;
  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader eyebrow="Overview" title={`Welcome, ${d.name.split(" ")[0]}`} sub={d.unread ? `You have ${d.unread} new notification${d.unread > 1 ? "s" : ""}.` : "Everything is up to date."} />
      {d.role === "admin" && <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Stat label="Students" value={d.students} /><Stat label="Teachers" value={d.teachers} />
        <Stat label="Attendance today" value={d.attendance_today == null ? "–" : `${d.attendance_today}%`} hint={d.attendance_today == null ? "No registers marked yet" : undefined} />
        <Stat label="Library uploads waiting" value={d.pending_uploads} hint="Waiting for the librarian" /><Stat label="Reports published" value={d.published_reports} /></div>}
      {d.role === "librarian" && <div className="grid gap-4 sm:grid-cols-2"><Stat label="Waiting for review" value={d.pending_uploads} hint="Teacher uploads" /><Stat label="In the library" value={d.approved} /></div>}
      {d.role === "librarian" && <Link to="/library?tab=review" className="btn-primary mt-5">Review uploads <ArrowRight size={16} /></Link>}
      {teacher && <>
        <div className="grid gap-4 sm:grid-cols-2"><Stat label="Your classes" value={d.classes} /><Stat label="Marks still to enter" value={(todo ?? []).reduce((n: number, a: any) => n + (a.total - a.entered), 0)} /></div>
        <h2 className="mb-3 mt-8 font-display text-lg text-navy-800">Mark entry progress</h2>
        {(todo ?? []).length === 0 ? <Empty title="No assessments yet" hint="Create one in Mark entry." /> : <div className="grid gap-3 sm:grid-cols-2">{(todo ?? []).slice(0, 6).map((a: any) => (
          <Link key={a.id} to={`/marks?a=${a.id}`} className="card p-4 transition hover:shadow-lg"><div className="flex justify-between gap-2"><p className="font-medium">{a.subject}</p><Badge tone={a.entered === a.total ? "green" : "amber"}>{a.entered}/{a.total}</Badge></div>
            <p className="text-sm text-mute">{a.class} · {a.title}</p><div className="mt-3 h-1.5 rounded bg-navy-100"><div className="h-1.5 rounded bg-gold-500" style={{ width: `${a.total ? (100 * a.entered) / a.total : 0}%` }} /></div></Link>))}</div>}</>}
      {(d.role === "student" || d.role === "parent") && (d.children?.length ? <div className="grid gap-4 sm:grid-cols-2">{d.children.map((k: any) => (
        <div key={k.id} className="card flex items-center gap-4 p-5"><Ring pct={k.attendance} /><div className="min-w-0 flex-1"><p className="truncate font-display text-lg text-navy-800">{k.name}</p><p className="text-sm text-mute">{k.class ?? "No class"} · attendance, last 30 days</p>
          <Link to="/report-cards" className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-navy-600 hover:underline">View results <ArrowRight size={14} /></Link></div></div>))}</div>
        : <Empty title="No learner linked yet" hint="Please ask the school office to link your account to your child." />)}
    </div>
  );
}
