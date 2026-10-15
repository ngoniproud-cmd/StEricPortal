import { useEffect, useMemo, useState } from "react";
import {
  Bell,
  BookOpen,
  CalendarCheck,
  CalendarDays,
  Clock,
  Coffee,
  MapPin,
  Plus,
  Printer,
  Trash2,
  Trophy,
  User,
  Utensils,
  X,
} from "lucide-react";
import { api, session } from "../lib/api";
import { useFetch } from "../lib/hooks";
import { Empty, ErrorNote, Field, PageHeader, Select, Spinner } from "../components/ui";

/* ── Period schedule ─────────────────────────────────────────── */

const DAYS = [
  { id: 1, name: "Monday", short: "Mon" },
  { id: 2, name: "Tuesday", short: "Tue" },
  { id: 3, name: "Wednesday", short: "Wed" },
  { id: 4, name: "Thursday", short: "Thu" },
  { id: 5, name: "Friday", short: "Fri" },
];

interface PeriodMeta {
  period: number;
  time: string;
  start: string;
  end: string;
  isBreak?: boolean;
  breakLabel?: string;
  breakIcon?: any;
}

const PERIOD_SCHEDULE: PeriodMeta[] = [
  { period: 1, time: "07:45 – 08:30", start: "07:45", end: "08:30" },
  { period: 2, time: "08:30 – 09:15", start: "08:30", end: "09:15" },
  { period: -1, time: "09:15 – 09:35", start: "09:15", end: "09:35", isBreak: true, breakLabel: "Tea Break", breakIcon: Coffee },
  { period: 3, time: "09:35 – 10:20", start: "09:35", end: "10:20" },
  { period: 4, time: "10:20 – 11:05", start: "10:20", end: "11:05" },
  { period: -2, time: "11:05 – 11:20", start: "11:05", end: "11:20", isBreak: true, breakLabel: "Short Break", breakIcon: Coffee },
  { period: 5, time: "11:20 – 12:05", start: "11:20", end: "12:05" },
  { period: 6, time: "12:05 – 12:50", start: "12:05", end: "12:50" },
  { period: -3, time: "12:50 – 13:45", start: "12:50", end: "13:45", isBreak: true, breakLabel: "Lunch", breakIcon: Utensils },
  { period: 7, time: "13:45 – 14:30", start: "13:45", end: "14:30" },
  { period: 8, time: "14:30 – 15:15", start: "14:30", end: "15:15" },
  { period: -4, time: "15:15 – 16:30", start: "15:15", end: "16:30", isBreak: true, breakLabel: "Sports / Clubs", breakIcon: Trophy },
];

/* ── Helpers ──────────────────────────────────────────────────── */

function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function getCurrentPeriod(): { period: number; nextPeriod: number | null } | null {
  const now = new Date();
  const day = now.getDay();
  if (day < 1 || day > 5) return null;
  const mins = now.getHours() * 60 + now.getMinutes();
  const lessons = PERIOD_SCHEDULE.filter(p => !p.isBreak);
  for (let i = 0; i < lessons.length; i++) {
    const p = lessons[i];
    if (mins >= timeToMinutes(p.start) && mins < timeToMinutes(p.end)) {
      return { period: p.period, nextPeriod: lessons[i + 1]?.period ?? null };
    }
  }
  // between periods - find next
  for (const p of lessons) {
    if (mins < timeToMinutes(p.start)) {
      return { period: -1, nextPeriod: p.period };
    }
  }
  return null;
}

/* ── Next Lesson Banner (Teacher) ───────────────────────────── */

function NextLessonBanner({ slots }: { slots: any[] }) {
  const [info, setInfo] = useState<{ current: any; next: any } | null>(null);

  useEffect(() => {
    function update() {
      const cp = getCurrentPeriod();
      if (!cp) { setInfo(null); return; }
      const today = new Date().getDay();
      const current = cp.period > 0 ? slots.find(s => s.day === today && s.period === cp.period) : null;
      const next = cp.nextPeriod ? slots.find(s => s.day === today && s.period === cp.nextPeriod) : null;
      setInfo({ current, next });
    }
    update();
    const t = setInterval(update, 30_000);
    return () => clearInterval(t);
  }, [slots]);

  if (!info || (!info.current && !info.next)) return null;

  return (
    <div className="mb-6 rounded-xl border-2 border-navy-200 bg-white overflow-hidden print:hidden">
      <div className="bg-navy-700 px-5 py-2.5">
        <p className="text-xs font-bold uppercase tracking-wider text-white flex items-center gap-2">
          <Clock size={14} /> Live Schedule
        </p>
      </div>
      <div className="grid sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-navy-100">
        {info.current && (
          <div className="p-5">
            <p className="text-[10px] font-bold uppercase tracking-widest text-navy-500 mb-1">Teaching Now</p>
            <p className="text-lg font-extrabold text-navy-900">{info.current.subject}</p>
            <div className="mt-1.5 flex items-center gap-3 text-xs text-slate-600">
              {info.current.class && <span className="font-semibold">{info.current.class}</span>}
              {info.current.room && <span className="flex items-center gap-1"><MapPin size={12} />{info.current.room}</span>}
            </div>
          </div>
        )}
        {info.next && (
          <div className="p-5">
            <p className="text-[10px] font-bold uppercase tracking-widest text-crimson-600 mb-1">Up Next</p>
            <p className="text-lg font-extrabold text-navy-900">{info.next.subject}</p>
            <div className="mt-1.5 flex items-center gap-3 text-xs text-slate-600">
              {info.next.class && <span className="font-semibold">{info.next.class}</span>}
              {info.next.room && <span className="flex items-center gap-1"><MapPin size={12} />{info.next.room}</span>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Temporary Lesson Reminder Toast ─────────────────────────── */

function LessonReminder({ slots }: { slots: any[] }) {
  const [reminder, setReminder] = useState<any>(null);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  useEffect(() => {
    function check() {
      const now = new Date();
      const day = now.getDay();
      if (day < 1 || day > 5) return;
      const mins = now.getHours() * 60 + now.getMinutes();
      const lessons = PERIOD_SCHEDULE.filter(p => !p.isBreak);
      for (const p of lessons) {
        const startMins = timeToMinutes(p.start);
        const diff = startMins - mins;
        if (diff > 0 && diff <= 5) {
          const slot = slots.find(s => s.day === day && s.period === p.period);
          if (slot) {
            const key = `${day}-${p.period}`;
            if (!dismissed.has(key)) {
              setReminder({ ...slot, periodTime: p.time, key });
              return;
            }
          }
        }
      }
    }
    check();
    const t = setInterval(check, 30_000);
    return () => clearInterval(t);
  }, [slots, dismissed]);

  if (!reminder) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 w-80 rounded-xl border-2 border-crimson-300 bg-white shadow-elevated animate-fade-in print:hidden">
      <div className="bg-crimson-600 px-4 py-2 rounded-t-[10px] flex items-center justify-between">
        <span className="text-xs font-bold text-white flex items-center gap-1.5"><Bell size={13} /> Lesson Starting Soon</span>
        <button
          onClick={() => { setDismissed(s => new Set(s).add(reminder.key)); setReminder(null); }}
          className="text-white/80 hover:text-white cursor-pointer"
        ><X size={16} /></button>
      </div>
      <div className="p-4">
        <p className="font-bold text-navy-900">{reminder.subject}</p>
        <p className="text-xs text-slate-600 mt-1">
          {reminder.class && <span className="font-semibold">{reminder.class} · </span>}
          {reminder.room && <><MapPin size={11} className="inline" /> {reminder.room} · </>}
          {reminder.periodTime}
        </p>
      </div>
    </div>
  );
}

/* ── Professional Weekly Grid Table ─────────────────────────── */

function WeeklyGrid({ slots, canEdit, reload }: { slots: any[]; canEdit?: boolean; reload?: () => void }) {
  return (
    <div className="rounded-xl border-2 border-navy-200 bg-white overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[800px] border-collapse">
          {/* Header */}
          <thead>
            <tr>
              <th className="w-[130px] bg-navy-700 text-white px-4 py-3 text-xs font-bold uppercase tracking-wider text-left border-r border-navy-600">
                Time
              </th>
              {DAYS.map(d => (
                <th key={d.id} className="bg-navy-700 text-white px-4 py-3 text-xs font-bold uppercase tracking-wider text-center border-r border-navy-600 last:border-r-0">
                  {d.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PERIOD_SCHEDULE.map((pMeta, rowIdx) => {
              if (pMeta.isBreak) {
                const Icon = pMeta.breakIcon || Coffee;
                return (
                  <tr key={`break-${rowIdx}`} className="bg-navy-50/50">
                    <td className="px-4 py-2 text-xs font-semibold text-navy-600 border-r border-navy-100 border-b border-navy-100 whitespace-nowrap">
                      {pMeta.time}
                    </td>
                    <td colSpan={5} className="px-4 py-2 border-b border-navy-100">
                      <div className="flex items-center gap-2 text-xs font-semibold text-navy-500">
                        <Icon size={13} />
                        <span>{pMeta.breakLabel}</span>
                      </div>
                    </td>
                  </tr>
                );
              }

              return (
                <tr key={`period-${pMeta.period}`} className="hover:bg-navy-50/30 transition-colors">
                  {/* Time column */}
                  <td className="px-4 py-3 bg-navy-50/40 border-r border-navy-100 border-b border-navy-100 align-top">
                    <div className="text-xs font-bold text-navy-800">Period {pMeta.period}</div>
                    <div className="text-[11px] text-navy-500 mt-0.5">{pMeta.time}</div>
                  </td>

                  {/* Day cells */}
                  {DAYS.map(day => {
                    const slot = slots.find(s => s.day === day.id && s.period === pMeta.period);
                    return (
                      <td key={day.id} className="px-2 py-2 border-r border-navy-100 border-b border-navy-100 last:border-r-0 align-top min-w-[130px]">
                        {slot ? (
                          <div className="rounded-lg bg-white border border-navy-200 p-2.5 shadow-sm hover:shadow transition-shadow">
                            <p className="font-bold text-sm text-navy-900 leading-tight">{slot.subject}</p>
                            {slot.teacher && (
                              <p className="text-[11px] text-slate-600 mt-1 flex items-center gap-1 truncate">
                                <User size={10} className="shrink-0 text-slate-400" />
                                {slot.teacher}
                              </p>
                            )}
                            {slot.room && (
                              <p className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                                <MapPin size={10} className="shrink-0 text-slate-400" />
                                {slot.room}
                              </p>
                            )}
                            {canEdit && (
                              <button
                                className="mt-1.5 text-[10px] text-red-500 hover:text-red-700 font-semibold flex items-center gap-0.5 cursor-pointer"
                                onClick={() =>
                                  confirm("Remove this lesson?") &&
                                  api(`/timetable/${slot.id}`, { method: "DELETE" }).then(reload)
                                }
                              >
                                <Trash2 size={10} /> Remove
                              </button>
                            )}
                          </div>
                        ) : (
                          <div className="h-full min-h-[56px] rounded-lg border border-dashed border-navy-100 bg-navy-50/20 flex items-center justify-center">
                            <span className="text-[10px] text-navy-300">—</span>
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ── Admin / Class Teacher Builder ──────────────────────────── */

function Builder({ managedClasses }: { managedClasses?: any[] }) {
  const isAdmin = session.role() === "admin";
  const classes = useFetch(isAdmin ? "/classes" : null);
  const subjects = useFetch("/subjects");
  const teachers = useFetch("/users?role=teacher");

  const classList = isAdmin ? (classes.data ?? []) : (managedClasses ?? []);

  const [cid, setCid] = useState("");
  const grid = useFetch(cid ? `/timetable/class/${cid}` : null);
  const [f, setF] = useState<any>({ day: "1", period: "1" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const set = (k: string) => (v: string) => setF((s: any) => ({ ...s, [k]: v }));

  async function add() {
    setErr(""); setBusy(true);
    try {
      await api("/timetable", {
        method: "POST",
        json: { class_id: cid, subject_id: f.subject_id, teacher_id: f.teacher_id, day: +f.day, period: +f.period, room: f.room || null },
      });
      grid.reload();
    } catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
  }

  return (
    <>
      <div className="card-static mb-6 p-6 space-y-4">
        <h2 className="text-sm font-bold text-navy-900 flex items-center gap-2 pb-3 border-b border-slate-100">
          <Clock size={16} className="text-navy-600" /> Add Lesson Slot
        </h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Class">
            <Select value={cid} onChange={setCid}>
              <option value="">Choose class</option>
              {classList.map((c: any) => (
                <option key={c.id} value={c.id}>{c.name} ({c.year})</option>
              ))}
            </Select>
          </Field>
          <Field label="Subject">
            <Select value={f.subject_id} onChange={set("subject_id")}>
              <option value="">Choose subject</option>
              {(subjects.data ?? []).map((s: any) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </Select>
          </Field>
          <Field label="Teacher">
            <Select value={f.teacher_id} onChange={set("teacher_id")}>
              <option value="">Choose teacher</option>
              {(teachers.data ?? []).map((t: any) => (
                <option key={t.id} value={t.id}>{t.full_name}</option>
              ))}
            </Select>
          </Field>
          <Field label="Day">
            <Select value={f.day} onChange={set("day")}>
              {DAYS.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </Select>
          </Field>
          <Field label="Period">
            <Select value={f.period} onChange={set("period")}>
              {PERIOD_SCHEDULE.filter(p => !p.isBreak).map(p => (
                <option key={p.period} value={p.period}>Period {p.period} ({p.time})</option>
              ))}
            </Select>
          </Field>
          <Field label="Room (optional)">
            <input className="input" placeholder="e.g. Room 12" value={f.room ?? ""} onChange={e => set("room")(e.target.value)} />
          </Field>
        </div>
        <div className="flex items-center justify-between pt-2">
          <ErrorNote msg={err} />
          <button
            className="btn-primary ml-auto"
            disabled={busy || !cid || !f.subject_id || !f.teacher_id}
            onClick={add}
          >
            <Plus size={14} />
            {busy ? "Assigning..." : "Assign Lesson"}
          </button>
        </div>
      </div>

      {cid && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-navy-800">
              {classList.find((c: any) => c.id === cid)?.name ?? "Class"} Weekly Timetable
            </h3>
            <button onClick={() => window.print()} className="btn-outline text-xs !py-2 print:hidden">
              <Printer size={14} /> Print
            </button>
          </div>
          {grid.loading ? <Spinner /> : <WeeklyGrid slots={grid.data ?? []} canEdit reload={grid.reload} />}
        </div>
      )}
    </>
  );
}

/* ── Main Page ──────────────────────────────────────────────── */

export default function Timetable() {
  const role = session.role();
  const isAdmin = role === "admin";
  const mine = useFetch(isAdmin ? null : "/timetable/mine");

  // For teachers: check if they are a class teacher (can manage timetable)
  const managedClasses = useMemo(() => {
    if (role !== "teacher" || !mine.data?.[0]?.managed_classes) return [];
    return mine.data[0].managed_classes;
  }, [mine.data, role]);

  const isClassTeacher = managedClasses.length > 0;
  const [showBuilder, setShowBuilder] = useState(false);

  return (
    <div className="mx-auto max-w-6xl page-enter pb-16">
      <PageHeader
        eyebrow="Academic Schedule"
        title="Timetable"
        sub={isAdmin ? "Manage weekly lesson schedules" : "Weekly class schedule"}
      >
        {!isAdmin && (
          <div className="flex items-center gap-2 print:hidden">
            {isClassTeacher && (
              <button onClick={() => setShowBuilder(b => !b)} className="btn-accent text-xs">
                <CalendarCheck size={14} />
                {showBuilder ? "View My Schedule" : "Manage Class Timetable"}
              </button>
            )}
            <button onClick={() => window.print()} className="btn-outline text-xs !py-2.5">
              <Printer size={14} /> Print
            </button>
          </div>
        )}
      </PageHeader>

      {/* Admin always sees builder */}
      {isAdmin ? (
        <Builder />
      ) : mine.loading ? (
        <Spinner />
      ) : mine.error ? (
        <ErrorNote msg={mine.error} />
      ) : showBuilder && isClassTeacher ? (
        <Builder managedClasses={managedClasses} />
      ) : !(mine.data ?? []).some((t: any) => t.slots.length) ? (
        <Empty
          title="Timetable not published yet"
          hint="The school has not released the timetable for your class yet."
        />
      ) : (
        <div className="space-y-8">
          {mine.data.map((stream: any) => (
            <div key={stream.title} className="space-y-4">
              {/* Teacher: Next Lesson Banner */}
              {role === "teacher" && <NextLessonBanner slots={stream.slots} />}

              {/* Title bar */}
              <div className="flex items-center justify-between print:hidden">
                <div className="flex items-center gap-2">
                  <BookOpen size={16} className="text-navy-600" />
                  <h2 className="text-sm font-bold text-navy-900">{stream.title}</h2>
                </div>
              </div>

              {/* Weekly Grid */}
              <WeeklyGrid slots={stream.slots} />

              {/* Teacher: Lesson Reminder */}
              {role === "teacher" && <LessonReminder slots={stream.slots} />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
