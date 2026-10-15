import { useEffect, useRef, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  BookOpen,
  Bell,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  FileCheck2,
  FileText,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Megaphone,
  Menu,
  NotebookPen,
  PenLine,
  Settings,
  ShieldCheck,
  Sparkles,
  UserPlus,
  Users,
  Wallet,
  WifiOff,
  X,
} from "lucide-react";
import { api, session } from "../lib/api";
import { fmtDate } from "../lib/zim";

function getNavItems(role: string) {
  if (role === "admin") {
    return [
      { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, group: "" },
      // Office tabs right at the top for the Headmaster!
      { to: "/students", label: "Student Directory", icon: Users, group: "Office" },
      { to: "/setup", label: "School Setup", icon: Settings, group: "Office" },
      { to: "/applications", label: "Applications", icon: UserPlus, group: "Office" },
      { to: "/candidates", label: "ZIMSEC Candidates", icon: GraduationCap, group: "Office" },
      { to: "/admin", label: "People & Promotion", icon: ShieldCheck, group: "Office" },
      { to: "/fees", label: "Fees Management", icon: Wallet, group: "Office" },

      // Teaching & Supervision
      { to: "/marks", label: "Mark Entry", icon: PenLine, group: "Teaching" },
      { to: "/attendance", label: "Attendance", icon: ClipboardCheck, group: "Teaching" },
      { to: "/insights", label: "Learner Insights", icon: Sparkles, group: "Teaching" },
      { to: "/assignments", label: "Homework", icon: NotebookPen, group: "Teaching" },

      // Learning & Records
      { to: "/report-cards", label: "Report Cards", icon: FileText, group: "Learning" },
      { to: "/timetable", label: "Timetable", icon: Clock, group: "Learning" },
      { to: "/library", label: "Library", icon: BookOpen, group: "Learning" },

      // School Communications
      { to: "/announcements", label: "Announcements", icon: Megaphone, group: "School" },
      { to: "/notices", label: "Notices", icon: FileCheck2, group: "School" },
      { to: "/calendar", label: "Calendar", icon: CalendarDays, group: "School" },
    ];
  }

  if (role === "teacher") {
    return [
      { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, group: "" },
      { to: "/my-class", label: "My Class", icon: GraduationCap, group: "" },
      { to: "/teaching-classes", label: "Other Classes I Teach", icon: BookOpen, group: "" },
      // Teaching
      { to: "/marks", label: "Mark Entry", icon: PenLine, group: "Teaching" },
      { to: "/assignments", label: "Homework", icon: NotebookPen, group: "Teaching" },
      { to: "/attendance", label: "Attendance", icon: ClipboardCheck, group: "Teaching" },
      { to: "/insights", label: "Learner Insights", icon: Sparkles, group: "Teaching" },
      { to: "/setup", label: "Teaching Load", icon: Settings, group: "Teaching" },
      // Learning
      { to: "/report-cards", label: "Report Cards", icon: FileText, group: "Learning" },
      { to: "/timetable", label: "Timetable", icon: Clock, group: "Learning" },
      { to: "/library", label: "Library", icon: BookOpen, group: "Learning" },
      // School
      { to: "/announcements", label: "Announcements", icon: Megaphone, group: "School" },
      { to: "/notices", label: "Notices", icon: FileCheck2, group: "School" },
      { to: "/calendar", label: "Calendar", icon: CalendarDays, group: "School" },
    ];
  }

  if (role === "hod") {
    return [
      { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, group: "" },
      { to: "/setup", label: "Department Allocation", icon: Settings, group: "Office" },
      { to: "/my-class", label: "My Class", icon: GraduationCap, group: "Teaching" },
      { to: "/teaching-classes", label: "Other Classes I Teach", icon: BookOpen, group: "Teaching" },
      { to: "/marks", label: "Mark Entry", icon: PenLine, group: "Teaching" },
      { to: "/assignments", label: "Homework", icon: NotebookPen, group: "Teaching" },
      { to: "/attendance", label: "Attendance", icon: ClipboardCheck, group: "Teaching" },
      { to: "/insights", label: "Learner Insights", icon: Sparkles, group: "Teaching" },
      { to: "/report-cards", label: "Report Cards", icon: FileText, group: "Learning" },
      { to: "/timetable", label: "Timetable", icon: Clock, group: "Learning" },
      { to: "/library", label: "Library", icon: BookOpen, group: "Learning" },
      { to: "/announcements", label: "Announcements", icon: Megaphone, group: "School" },
      { to: "/notices", label: "Notices", icon: FileCheck2, group: "School" },
      { to: "/calendar", label: "Calendar", icon: CalendarDays, group: "School" },
    ];
  }

  // Student / Parent / Librarian
  return [
    { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ["librarian", "student", "parent"], group: "" },
    { to: "/assessments", label: "Assessments", icon: FileText, roles: ["student", "parent"], group: "" },
    { to: "/report-cards", label: "Report Cards", icon: FileText, roles: ["student", "parent"], group: "Learning" },
    { to: "/timetable", label: "Timetable", icon: Clock, roles: ["student", "parent"], group: "Learning" },
    { to: "/assignments", label: "Homework", icon: NotebookPen, roles: ["student", "parent"], group: "Learning" },
    { to: "/library", label: "Library", icon: BookOpen, roles: ["librarian", "student"], group: "Learning" },
    { to: "/fees", label: "Fees", icon: Wallet, roles: ["student", "parent"], group: "School" },
    { to: "/announcements", label: "Announcements", icon: Megaphone, roles: ["student", "parent"], group: "School" },
    { to: "/notices", label: "Notices", icon: FileCheck2, roles: ["student", "parent"], group: "School" },
    { to: "/calendar", label: "Calendar", icon: CalendarDays, roles: ["librarian", "student", "parent"], group: "School" },
  ].filter(i => i.roles.includes(role));
}

function Bell_() {
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  const [d, setD] = useState<{ unread: number; items: any[] }>({ unread: 0, items: [] });
  const ref = useRef<HTMLDivElement>(null);

  const load = () => {
    api("/notifications")
      .then(res => setD({ unread: res.unread || 0, items: res.items || [] }))
      .catch(() => {});
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 30_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const markAllRead = async () => {
    setD(prev => ({
      unread: 0,
      items: prev.items.map(it => ({ ...it, read: true }))
    }));
    try {
      await api("/notifications/read-all", { method: "POST" });
    } catch {}
  };

  const handleOpen = () => {
    setOpen(prev => {
      const next = !prev;
      if (next && d.unread > 0) {
        markAllRead();
      }
      return next;
    });
  };

  const handleItemClick = async (n: any) => {
    setD(prev => ({
      unread: Math.max(0, prev.unread - (n.read ? 0 : 1)),
      items: prev.items.map(it => (it.id === n.id ? { ...it, read: true } : it))
    }));
    try {
      await api(`/notifications/${n.id}/read`, { method: "POST" });
    } catch {}
    setOpen(false);
    if (n.link) nav(n.link);
  };

  const clearAll = async () => {
    setD({ unread: 0, items: [] });
    try {
      await api("/notifications", { method: "DELETE" });
    } catch {}
  };

  const dismissOne = async (e: React.MouseEvent, nid: string) => {
    e.stopPropagation();
    setD(prev => ({
      unread: Math.max(0, prev.unread - (prev.items.find(x => x.id === nid)?.read ? 0 : 1)),
      items: prev.items.filter(x => x.id !== nid)
    }));
    try {
      await api(`/notifications/${nid}`, { method: "DELETE" });
    } catch {}
  };

  return (
    <div ref={ref} className="relative">
      <button
        aria-label="Notifications"
        onClick={handleOpen}
        className="relative rounded-xl p-2 sm:p-2.5 text-navy-700 transition hover:bg-slate-100 cursor-pointer"
      >
        <Bell size={18} className="sm:w-5 sm:h-5" />
        {d.unread > 0 && (
          <span className="absolute right-0.5 top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-crimson-600 px-1 text-[10px] font-bold text-white shadow-xs">
            {d.unread}
          </span>
        )}
      </button>

      {open && (
        <div className="card-static fixed inset-x-3 top-16 sm:absolute sm:inset-x-auto sm:right-0 sm:top-full z-50 mt-1 sm:w-88 max-w-[calc(100vw-1.5rem)] overflow-hidden shadow-elevated border border-navy-200">
          <div className="flex items-center justify-between border-b border-line bg-navy-50/80 px-4 py-2.5">
            <div className="flex items-center gap-2">
              <span className="font-display text-sm font-bold text-navy-900">Notifications</span>
              {d.unread > 0 && (
                <span className="rounded bg-crimson-100 px-1.5 py-0.2 text-[10px] font-bold text-crimson-700">
                  {d.unread} new
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {d.items.length > 0 && (
                <>
                  <button
                    onClick={markAllRead}
                    className="text-[11px] font-bold text-navy-700 hover:text-navy-900 hover:underline cursor-pointer"
                  >
                    Mark read
                  </button>
                  <span className="text-slate-300">·</span>
                  <button
                    onClick={clearAll}
                    className="text-[11px] font-semibold text-mute hover:text-crimson-600 cursor-pointer"
                  >
                    Clear all
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
            {d.items.length === 0 ? (
              <div className="p-6 text-center text-xs text-mute">
                <CheckCircle2 size={24} className="mx-auto mb-2 text-emerald-500" />
                You're all caught up! No active notifications.
              </div>
            ) : (
              d.items.map((n: any) => (
                <div
                  key={n.id}
                  onClick={() => handleItemClick(n)}
                  className={`group relative flex items-start justify-between gap-3 p-3.5 text-left transition cursor-pointer ${
                    n.read ? "bg-white hover:bg-slate-50" : "bg-crimson-50/40 hover:bg-crimson-50/70"
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      {!n.read && <span className="h-2 w-2 rounded-full bg-crimson-600 shrink-0" />}
                      <p className={`text-xs ${n.read ? "font-semibold text-slate-800" : "font-black text-navy-900"}`}>
                        {n.title}
                      </p>
                    </div>
                    {n.body && <p className="mt-1 line-clamp-2 text-[11px] text-mute">{n.body}</p>}
                    <p className="mt-1.5 text-[10px] text-slate-400 font-mono">{fmtDate(n.created_at)}</p>
                  </div>
                  <button
                    onClick={(e) => dismissOne(e, n.id)}
                    aria-label="Dismiss notification"
                    className="shrink-0 p-1 text-slate-300 hover:text-slate-600 transition rounded"
                  >
                    &times;
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Initials({ name }: { name: string }) {
  const parts = name.split(" ");
  const initials = parts.length >= 2 ? parts[0][0] + parts[parts.length - 1][0] : parts[0]?.slice(0, 2) ?? "";
  return (
    <div className="grid h-8 w-8 sm:h-9 sm:w-9 shrink-0 place-items-center rounded-full bg-crimson-600 text-xs font-bold text-white shadow-xs">
      {initials.toUpperCase()}
    </div>
  );
}

export default function Shell() {
  const nav = useNavigate();
  const role = session.role();
  const [offline, setOffline] = useState(!navigator.onLine);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const on = () => setOffline(false), off = () => setOffline(true);
    addEventListener("online", on);
    addEventListener("offline", off);
    return () => {
      removeEventListener("online", on);
      removeEventListener("offline", off);
    };
  }, []);

  const items = getNavItems(role);
  const userName = session.name();

  return (
    <div className="min-h-screen md:flex">
      {/* Mobile Drawer Backdrop */}
      {mobileMenuOpen && (
        <div
          onClick={() => setMobileMenuOpen(false)}
          className="fixed inset-0 z-40 bg-navy-950/60 backdrop-blur-xs md:hidden animate-fade-in"
        />
      )}

      {/* Main Sidebar (Desktop fixed, Mobile Slide-out drawer) */}
      <aside
        className={`hero-gradient text-white z-50 md:sticky md:top-0 md:h-screen md:w-64 md:shrink-0 md:flex md:flex-col border-r border-navy-900/50 shadow-lg dark-scroll transition-transform duration-300 ease-in-out ${
          mobileMenuOpen
            ? "fixed inset-y-0 left-0 w-72 flex flex-col translate-x-0"
            : "hidden md:flex md:translate-x-0"
        }`}
      >
        {/* Logo section */}
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4 sm:py-5 bg-[#091529]/60">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-xl bg-white p-1 flex items-center justify-center shrink-0 shadow-sm border border-white/20">
              <img src="/logo-white.png" alt="St Eric High School" className="h-full w-full object-contain" />
            </div>
            <div>
              <div className="font-display text-sm sm:text-base font-black leading-tight text-white uppercase tracking-tight">St Eric High</div>
              <div className="text-[10px] font-bold tracking-widest text-[#f87171] uppercase">Norton, Zimbabwe</div>
            </div>
          </div>
          <button
            onClick={() => setMobileMenuOpen(false)}
            className="md:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10"
          >
            <X size={20} />
          </button>
        </div>

        {/* Navigation list */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-1 dark-scroll">
          {items.map(({ to, label, icon: Icon, group }, i) => (
            <div key={to}>
              {group && group !== items[i - 1]?.group && (
                <p className="px-3 pb-1 pt-4 text-[10px] font-black uppercase tracking-[0.18em] text-[#93c5fd]">
                  {group}
                </p>
              )}
              <NavLink
                to={to}
                onClick={() => setMobileMenuOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-xs font-bold transition-all duration-150 ${
                    isActive
                      ? "bg-[#c41e2a] text-white shadow-md ring-1 ring-white/30"
                      : "text-slate-300 hover:bg-white/10 hover:text-white"
                  }`
                }
              >
                <Icon size={16} /> <span>{label}</span>
              </NavLink>
            </div>
          ))}
        </nav>

        {/* User profile & sign-out bottom area */}
        <div className="border-t border-white/10 p-4 bg-[#091529]/80">
          <div className="flex items-center gap-3 mb-3">
            <Initials name={userName} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-black text-white">{userName}</p>
              <p className="text-[10px] uppercase font-bold tracking-wider text-[#dba83a]">{role}</p>
            </div>
          </div>
          <button
            onClick={() => {
              session.clear();
              nav("/");
            }}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-bold text-slate-400 transition hover:bg-white/10 hover:text-white cursor-pointer"
          >
            <LogOut size={15} /> Sign out
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="min-w-0 flex-1 flex flex-col">
        {offline && (
          <div className="flex items-center justify-center gap-2 bg-amber-50 border-b border-amber-200 px-4 py-2 text-xs sm:text-sm text-amber-800">
            <WifiOff size={16} /> You're offline. Showing cached content.
          </div>
        )}

        {/* Top Header */}
        <header className="sticky top-0 bg-white border-b border-slate-200/80 px-3 py-2.5 sm:px-6 sm:py-3 flex items-center justify-between gap-2 shadow-xs z-30">
          <div className="flex items-center gap-2 sm:gap-3.5 min-w-0">
            {/* Mobile Hamburger Button */}
            <button
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open menu"
              className="md:hidden p-1.5 -ml-1 rounded-lg text-navy-800 hover:bg-slate-100 cursor-pointer"
            >
              <Menu size={22} />
            </button>

            <div className="h-8 w-8 sm:h-9 sm:w-9 rounded-xl bg-white p-1 border border-slate-200 shadow-xs flex items-center justify-center shrink-0">
              <img src="/logo-white.png" alt="St Eric Crest" className="h-full w-full object-contain" />
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-xs sm:text-sm font-black text-slate-900 uppercase tracking-tight leading-none truncate">
                  St Eric High
                </span>
                <span className="hidden sm:inline text-xs font-bold text-[#c41e2a] uppercase tracking-wider">
                  · Service & Excellence
                </span>
              </div>
              <p className="text-[10px] sm:text-xs text-slate-500 font-medium mt-0.5 truncate">
                <span className="hidden xs:inline">User: </span>
                <b className="text-slate-800 font-bold">{userName}</b>{" "}
                <span className="text-[10px] font-semibold text-slate-400 capitalize">({role})</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
            {/* Active Academic Term Badge */}
            <div className="flex items-center gap-1 px-2 sm:px-3 py-1 rounded-lg bg-navy-50 text-navy-800 text-[10px] sm:text-xs font-bold border border-navy-100">
              <span className="hidden sm:inline text-slate-500 font-medium">Active:</span>
              <span className="text-crimson-600 font-extrabold">Term 3</span>
              <span className="text-navy-900 font-extrabold">2026</span>
            </div>

            <Bell_ />

            <button
              onClick={() => {
                session.clear();
                nav("/");
              }}
              title="Sign Out"
              className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 px-2.5 py-1.5 sm:px-3.5 sm:py-1.5 text-xs font-bold text-slate-700 cursor-pointer transition shadow-2xs"
            >
              <LogOut size={14} className="text-[#c41e2a]" />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        </header>

        {/* Mobile Quick Navigation Strip */}
        <div className="md:hidden border-b border-slate-200/80 bg-navy-900 px-2 py-1.5 overflow-x-auto dark-scroll">
          <div className="flex gap-1 min-w-max">
            {items.slice(0, 7).map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold whitespace-nowrap transition ${
                    isActive
                      ? "bg-crimson-600 text-white"
                      : "text-slate-300 hover:text-white hover:bg-white/10"
                  }`
                }
              >
                <Icon size={12} />
                <span>{label}</span>
              </NavLink>
            ))}
          </div>
        </div>

        {/* Main page container with responsive mobile padding */}
        <main className="flex-1 p-3 sm:p-5 md:p-8 lg:p-10 bg-[#f8fafc]">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
