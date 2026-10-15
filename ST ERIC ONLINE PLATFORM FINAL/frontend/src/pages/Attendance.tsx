import { useEffect, useMemo, useState } from "react";
import { Calendar, CheckCircle2, ChevronLeft, ChevronRight, Clock, UserCheck, Users, AlertTriangle } from "lucide-react";
import { api } from "../lib/api";
import { useFetch } from "../lib/hooks";
import { Empty, ErrorNote, Field, PageHeader, Select, Spinner, useToast } from "../components/ui";

const OPTS = [
  { key: "present", label: "P", name: "Present", color: "bg-emerald-600 text-white hover:bg-emerald-700" },
  { key: "absent", label: "A", name: "Absent", color: "bg-crimson-600 text-white hover:bg-crimson-700" },
  { key: "late", label: "L", name: "Late", color: "bg-amber-500 text-white hover:bg-amber-600" },
  { key: "excused", label: "E", name: "Excused", color: "bg-navy-600 text-white hover:bg-navy-700" },
] as const;

export default function Attendance() {
  const classes = useFetch("/classes");
  const [cid, setCid] = useState("");
  const [day, setDay] = useState(new Date().toISOString().slice(0, 10));
  const toast = useToast();
  const reg = useFetch(cid ? `/attendance/class/${cid}?day=${day}` : null);
  const [rows, setRows] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (reg.data) setRows(reg.data.rows);
  }, [reg.data]);

  const stats = useMemo(() => {
    const total = rows.length;
    if (!total) return { present: 0, absent: 0, late: 0, excused: 0, rate: 0 };
    const p = rows.filter(r => r.status === "present").length;
    const a = rows.filter(r => r.status === "absent").length;
    const l = rows.filter(r => r.status === "late").length;
    const e = rows.filter(r => r.status === "excused").length;
    const rate = Math.round(((p + l) / total) * 100);
    return { present: p, absent: a, late: l, excused: e, rate };
  }, [rows]);

  function markAllPresent() {
    setRows(rs => rs.map(r => ({ ...r, status: "present" })));
    toast.show("All learners marked as Present.");
  }

  function shiftDay(delta: number) {
    const d = new Date(day);
    d.setDate(d.getDate() + delta);
    setDay(d.toISOString().slice(0, 10));
  }

  async function save() {
    setBusy(true);
    try {
      const r = await api(`/attendance/class/${cid}?day=${day}`, {
        method: "PUT",
        json: rows.map(x => ({ student_id: x.student_id, status: x.status })),
      });
      toast.show(`Attendance register saved.${r.absent ? ` ${r.absent} parent alert notification(s) generated.` : ""}`);
      reg.reload();
    } catch (e) {
      toast.show((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl page-enter pb-16">
      <PageHeader
        eyebrow="Daily Register"
        title="Attendance"
      >
        <button className="btn-primary" onClick={save} disabled={!rows.length || busy}>
          {busy ? "Saving..." : "Save Register"}
        </button>
      </PageHeader>

      {/* Class & Date Controls */}
      <div className="card-static mb-6 p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Class Group">
            <Select value={cid} onChange={setCid}>
              <option value="">Choose class...</option>
              {(classes.data ?? []).map((c: any) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.year})
                </option>
              ))}
            </Select>
          </Field>

          <div>
            <span className="label">Register Date</span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => shiftDay(-1)}
                className="rounded-lg border border-line p-2.5 text-navy-700 hover:bg-navy-50 transition"
                title="Previous Day"
              >
                <ChevronLeft size={16} />
              </button>
              <input
                type="date"
                className="input"
                value={day}
                max={new Date().toISOString().slice(0, 10)}
                onChange={e => setDay(e.target.value)}
              />
              <button
                onClick={() => setDay(new Date().toISOString().slice(0, 10))}
                className="btn-ghost !py-2 !px-3 text-xs"
              >
                Today
              </button>
            </div>
          </div>
        </div>
      </div>

      {reg.loading ? (
        <Spinner />
      ) : reg.error ? (
        <ErrorNote msg={reg.error} />
      ) : !cid ? (
        <Empty title="Select a Class" hint="Choose a class group to load the daily roll call register." />
      ) : !rows.length ? (
        <Empty title="No Students Found" hint="No active students currently enrolled in this class." />
      ) : (
        <>
          {/* Live Metrics Strip */}
          <div className="grid grid-cols-2 gap-3 mb-4 sm:grid-cols-4">
            <div className="card-static bg-white p-3.5 text-center">
              <p className="text-[11px] font-bold uppercase tracking-wider text-mute">Attendance Rate</p>
              <p className="mt-0.5 font-display text-2xl font-bold text-emerald-700">{stats.rate}%</p>
            </div>
            <div className="card-static bg-white p-3.5 text-center">
              <p className="text-[11px] font-bold uppercase tracking-wider text-mute">Present</p>
              <p className="mt-0.5 font-display text-2xl font-bold text-navy-900">{stats.present}</p>
            </div>
            <div className="card-static bg-white p-3.5 text-center">
              <p className="text-[11px] font-bold uppercase tracking-wider text-mute">Absent</p>
              <p className="mt-0.5 font-display text-2xl font-bold text-crimson-600">{stats.absent}</p>
            </div>
            <div className="card-static bg-white p-3.5 text-center">
              <p className="text-[11px] font-bold uppercase tracking-wider text-mute">Late / Excused</p>
              <p className="mt-0.5 font-display text-2xl font-bold text-amber-600">{stats.late + stats.excused}</p>
            </div>
          </div>

          {/* Action Toolbar */}
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-white px-4 py-2.5">
            <div className="text-xs text-mute">
              {reg.data?.already_marked ? (
                <span className="font-semibold text-navy-800">
                  Register recorded for {day}. Modifications will update existing records.
                </span>
              ) : (
                <span>Register not yet submitted for this date.</span>
              )}
            </div>
            <button
              onClick={markAllPresent}
              className="btn-outline !py-1 !px-3 text-xs"
            >
              <UserCheck size={14} /> Mark All Present
            </button>
          </div>

          {/* Student Attendance List */}
          <div className="card-static overflow-hidden shadow-elevated border-navy-200">
            <div className="border-b border-navy-800 bg-navy-800 px-5 py-3 text-xs font-semibold uppercase tracking-wider text-white flex justify-between items-center">
              <span>Learner Details</span>
              <span>Status Key: P (Present) · A (Absent) · L (Late) · E (Excused)</span>
            </div>
            <div className="divide-y divide-line">
              {rows.map((r, i) => (
                <div key={r.student_id} className="flex items-center justify-between gap-3 px-5 py-3.5 hover:bg-navy-50/30 transition">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-navy-900">{r.name}</p>
                    <p className="font-mono text-xs text-mute">{r.admission_no}</p>
                  </div>

                  <div className="flex gap-2" role="group" aria-label={`Attendance for ${r.name}`}>
                    {OPTS.map(opt => {
                      const active = r.status === opt.key;
                      return (
                        <button
                          key={opt.key}
                          aria-pressed={active}
                          aria-label={opt.name}
                          onClick={() => setRows(rs => rs.map((x, j) => (j === i ? { ...x, status: opt.key } : x)))}
                          className={`h-10 w-10 rounded-lg text-xs font-bold transition-all ${
                            active
                              ? `${opt.color} shadow-sm scale-105`
                              : "bg-paper text-mute hover:bg-navy-100 hover:text-navy-900"
                          }`}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {toast.node}
    </div>
  );
}
