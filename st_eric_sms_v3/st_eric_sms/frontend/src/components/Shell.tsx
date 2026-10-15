import { useEffect, useRef, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { BookOpen, Bell, CalendarDays, ClipboardCheck, Clock, FileCheck2, FileText, GraduationCap, LayoutDashboard, LogOut, Megaphone, NotebookPen, PenLine, Settings, ShieldCheck, Sparkles, UserPlus, Wallet, WifiOff } from "lucide-react";
import { api, session } from "../lib/api";
import { fmtDate } from "../lib/zim";
import { Logo } from "./ui";

const ALL = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ["admin", "teacher", "librarian", "student", "parent"], group: "" },
  { to: "/marks", label: "Mark entry", icon: PenLine, roles: ["teacher", "admin"], group: "Teaching" },
  { to: "/assignments", label: "Homework", icon: NotebookPen, roles: ["admin", "teacher", "student", "parent"], group: "Teaching" },
  { to: "/attendance", label: "Attendance", icon: ClipboardCheck, roles: ["teacher", "admin"], group: "Teaching" },
  { to: "/insights", label: "Learner insights", icon: Sparkles, roles: ["teacher", "admin"], group: "Teaching" },
  { to: "/report-cards", label: "Report cards", icon: FileText, roles: ["admin", "teacher", "student", "parent"], group: "Learning" },
  { to: "/timetable", label: "Timetable", icon: Clock, roles: ["admin", "teacher", "student", "parent"], group: "Learning" },
  { to: "/library", label: "Library", icon: BookOpen, roles: ["admin", "teacher", "librarian", "student"], group: "Learning" },
  { to: "/calendar", label: "Calendar", icon: CalendarDays, roles: ["admin", "teacher", "librarian", "student", "parent"], group: "School" },
  { to: "/announcements", label: "Announcements", icon: Megaphone, roles: ["admin", "teacher", "student", "parent"], group: "School" },
  { to: "/notices", label: "Notices", icon: FileCheck2, roles: ["admin", "teacher", "student", "parent"], group: "School" },
  { to: "/fees", label: "Fees", icon: Wallet, roles: ["admin", "student", "parent"], group: "School" },
  { to: "/applications", label: "Applications", icon: UserPlus, roles: ["admin"], group: "Office" },
  { to: "/candidates", label: "ZIMSEC candidates", icon: GraduationCap, roles: ["admin"], group: "Office" },
  { to: "/admin", label: "People and promotion", icon: ShieldCheck, roles: ["admin"], group: "Office" },
  { to: "/setup", label: "Setup", icon: Settings, roles: ["admin"], group: "Office" },
];

function Bell_() {
  const nav = useNavigate(); const [open, setOpen] = useState(false); const [d, setD] = useState<any>({ unread: 0, items: [] }); const ref = useRef<HTMLDivElement>(null);
  const load = () => api("/notifications").then(setD).catch(() => {});
  useEffect(() => { load(); const t = setInterval(load, 60_000); return () => clearInterval(t); }, []);
  useEffect(() => { const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }; document.addEventListener("mousedown", h); return () => document.removeEventListener("mousedown", h); }, []);
  return (
    <div ref={ref} className="relative">
      <button aria-label="Notifications" onClick={() => { setOpen(o => !o); if (!open && d.unread) api("/notifications/read-all", { method: "POST" }).then(() => setTimeout(load, 1500)); }} className="btn-ghost relative !p-2.5">
        <Bell size={20} />{d.unread > 0 && <span className="absolute right-1 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-gold-500 px-1 text-[10px] font-bold text-navy-900">{d.unread}</span>}
      </button>
      {open && <div className="card absolute right-0 z-40 mt-2 w-80 max-w-[85vw] overflow-hidden">
        <div className="border-b border-line px-4 py-3 font-display text-navy-800">Notifications</div>
        <div className="max-h-96 overflow-auto">{d.items.length === 0 && <p className="p-6 text-center text-sm text-mute">You're all caught up.</p>}
          {d.items.map((n: any) => <button key={n.id} onClick={() => { setOpen(false); if (n.link) nav(n.link); }} className={`block w-full border-b border-line px-4 py-3 text-left hover:bg-paper ${n.read ? "" : "bg-gold-100/40"}`}>
            <p className="text-sm font-medium text-ink">{n.title}</p>{n.body && <p className="mt-0.5 line-clamp-2 text-xs text-mute">{n.body}</p>}<p className="mt-1 text-[11px] text-mute">{fmtDate(n.created_at)}</p></button>)}</div>
      </div>}
    </div>
  );
}

export default function Shell() {
  const nav = useNavigate(); const role = session.role(); const [offline, setOffline] = useState(!navigator.onLine);
  useEffect(() => { const on = () => setOffline(false), off = () => setOffline(true); addEventListener("online", on); addEventListener("offline", off); return () => { removeEventListener("online", on); removeEventListener("offline", off); }; }, []);
  const items = ALL.filter(i => i.roles.includes(role));
  return (
    <div className="min-h-screen md:flex">
      <aside className="bg-navy-800 text-white md:sticky md:top-0 md:h-screen md:w-64 md:shrink-0 md:flex md:flex-col">
        <div className="flex items-center gap-3 border-b border-white/10 px-5 py-4"><Logo size={44} />
          <div><div className="font-display text-base leading-tight">St Eric High</div><div className="text-xs text-navy-200">Norton, Zimbabwe</div></div></div>
        <nav className="flex gap-1 overflow-x-auto p-3 md:flex-1 md:flex-col md:overflow-y-auto">
          {items.map(({ to, label, icon: Icon, group }, i) => (<div key={to} className="contents">
            {group && group !== items[i - 1]?.group && <p className="hidden px-3 pb-1 pt-4 text-[11px] font-medium uppercase tracking-widest text-navy-300 md:block">{group}</p>}
            <NavLink key={to} to={to} className={({ isActive }) => `flex shrink-0 items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition ${isActive ? "bg-white/10 text-white ring-1 ring-gold-500/60" : "text-navy-200 hover:bg-white/5 hover:text-white"}`}><Icon size={18} /> {label}</NavLink></div>))}
        </nav>
        <div className="hidden border-t border-white/10 p-3 md:block"><p className="truncate px-3 text-sm">{session.name()}</p><p className="px-3 pb-2 text-xs capitalize text-navy-300">{role}</p>
          <button onClick={() => { session.clear(); nav("/login"); }} className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-navy-200 hover:bg-white/5 hover:text-white"><LogOut size={18} /> Sign out</button></div>
      </aside>
      <div className="min-w-0 flex-1">
        {offline && <div className="flex items-center justify-center gap-2 bg-amber-100 px-4 py-2 text-sm text-amber-900"><WifiOff size={16} /> You're offline. Showing what was saved on this device.</div>}
        <header className="flex items-center justify-between gap-3 px-4 pt-4 md:px-8 md:pt-6"><p className="text-sm text-mute">Hello, <span className="font-medium text-ink">{session.name().split(" ")[0]}</span></p>
          <div className="flex items-center gap-1"><Bell_ /><button aria-label="Sign out" onClick={() => { session.clear(); nav("/login"); }} className="btn-ghost !p-2.5 md:hidden"><LogOut size={20} /></button></div></header>
        <main className="p-4 md:p-8 md:pt-4"><Outlet /></main>
      </div>
    </div>
  );
}
