import { useMemo, useState } from "react";
import { Search, CheckCircle, AlertCircle, ChevronRight } from "lucide-react";
import { useFetch } from "../lib/hooks";
import { Empty, ErrorNote, PageHeader, Spinner } from "../components/ui";

type StudentRow = {
  id: string;
  admission_no: string;
  name: string;
  gender: string | null;
  form: number | null;
  class_name: string | null;
  guardian: string | null;
  fees_cleared: boolean;
  fee_balance: Record<string, number>;
};

export default function StudentDirectory() {
  const { data, loading, error } = useFetch("/students");
  const [search, setSearch] = useState("");
  const [formFilter, setFormFilter] = useState("all");
  const [feeFilter, setFeeFilter] = useState("all");
  const [selected, setSelected] = useState<StudentRow | null>(null);
  const profileQ = useFetch(selected ? `/students/${selected.id}/profile` : null);

  const students: StudentRow[] = data ?? [];

  const filtered = useMemo(() => {
    return students.filter(s => {
      const q = search.toLowerCase();
      const matchSearch = !q ||
        s.name.toLowerCase().includes(q) ||
        s.admission_no.toLowerCase().includes(q) ||
        (s.class_name ?? "").toLowerCase().includes(q) ||
        (s.guardian ?? "").toLowerCase().includes(q);
      const matchForm = formFilter === "all" || String(s.form) === formFilter;
      const matchFee = feeFilter === "all" || (feeFilter === "cleared" ? s.fees_cleared : !s.fees_cleared);
      return matchSearch && matchForm && matchFee;
    });
  }, [students, search, formFilter, feeFilter]);

  const forms = [...new Set(students.map(s => s.form).filter(Boolean))].sort() as number[];

  if (loading) return <Spinner />;
  if (error) return <ErrorNote msg={error} />;

  return (
    <div className="mx-auto max-w-7xl page-enter pb-16">
      <PageHeader eyebrow="Administration" title="Student Directory">
        <span className="text-sm font-bold text-mute">{filtered.length} of {students.length} learners</span>
      </PageHeader>

      {/* Filters */}
      <div className="card-static mb-6 flex flex-col sm:flex-row items-stretch sm:items-center gap-4 p-4">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input className="input !pl-10 text-sm" placeholder="Search name, reg. number, class or guardian..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="input !w-36 text-sm" value={formFilter} onChange={e => setFormFilter(e.target.value)}>
          <option value="all">All Forms</option>
          {forms.map(f => <option key={f} value={f}>Form {f}</option>)}
        </select>
        <select className="input !w-36 text-sm" value={feeFilter} onChange={e => setFeeFilter(e.target.value)}>
          <option value="all">All Fee Status</option>
          <option value="cleared">Fees Cleared</option>
          <option value="balance">Balance Due</option>
        </select>
      </div>

      <div className="flex gap-6">
        {/* Table */}
        <div className={`flex-1 min-w-0 ${selected ? "hidden lg:block" : ""}`}>
          <div className="card-static overflow-hidden">
            <table className="w-full text-sm">
              <thead className="border-b border-navy-800 bg-navy-800 text-xs font-bold uppercase tracking-wider text-white">
                <tr>
                  <th className="px-5 py-3.5 text-left">Name</th>
                  <th className="px-4 py-3.5 text-left">Reg. No.</th>
                  <th className="px-4 py-3.5 text-left">Class</th>
                  <th className="px-4 py-3.5 text-left">Guardian</th>
                  <th className="px-4 py-3.5 text-center">Fees</th>
                  <th className="px-4 py-3.5 text-center"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.length === 0 ? (
                  <tr><td colSpan={6} className="px-5 py-12 text-center text-sm text-mute">No students match your filters.</td></tr>
                ) : filtered.map((s, i) => (
                  <tr key={s.id}
                    onClick={() => setSelected(selected?.id === s.id ? null : s)}
                    className={`cursor-pointer transition-colors ${
                      selected?.id === s.id ? "bg-navy-50 border-l-4 border-l-navy-700" : i % 2 === 0 ? "bg-white hover:bg-slate-50" : "bg-slate-50/40 hover:bg-slate-100"
                    }`}>
                    <td className="px-5 py-3">
                      <div className="font-bold text-navy-900">{s.name}</div>
                      <div className="text-xs text-mute">{s.gender === "M" ? "Male" : s.gender === "F" ? "Female" : ""}</div>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-600">{s.admission_no}</td>
                    <td className="px-4 py-3 text-xs">
                      {s.class_name ? <><span className="font-bold text-navy-900">{s.class_name}</span><br /><span className="text-mute">Form {s.form}</span></> : <span className="text-mute">Unassigned</span>}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600">{s.guardian ?? <span className="text-mute">Not linked</span>}</td>
                    <td className="px-4 py-3 text-center">
                      {s.fees_cleared
                        ? <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200"><CheckCircle size={11} />Cleared</span>
                        : <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700 border border-amber-200"><AlertCircle size={11} />Balance</span>
                      }
                    </td>
                    <td className="px-4 py-3 text-center">
                      <ChevronRight size={16} className={`mx-auto transition-transform ${selected?.id === s.id ? "rotate-90 text-navy-600" : "text-slate-300"}`} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Profile Panel */}
        {selected && (
          <div className="w-full lg:w-80 shrink-0">
            <div className="card-static p-5 sticky top-4 space-y-4 animate-fade-in">
              <div className="flex items-center justify-between">
                <div className="h-12 w-12 rounded-xl bg-navy-700 text-white font-black text-lg grid place-items-center">
                  {selected.name.charAt(0)}
                </div>
                <button onClick={() => setSelected(null)} className="text-slate-400 hover:text-slate-700 text-xl font-bold cursor-pointer">&times;</button>
              </div>
              <div>
                <p className="font-display text-lg font-black text-navy-900">{selected.name}</p>
                <p className="text-xs text-mute font-mono">{selected.admission_no}</p>
                <p className="text-xs text-slate-600 mt-0.5">{selected.class_name ?? "No class"} &middot; Form {selected.form}</p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg bg-slate-50 p-3 text-center">
                  <p className="text-[10px] font-bold uppercase text-mute">Gender</p>
                  <p className="font-bold text-sm text-navy-900">{selected.gender === "M" ? "Male" : selected.gender === "F" ? "Female" : "\u2014"}</p>
                </div>
                <div className="rounded-lg bg-slate-50 p-3 text-center">
                  <p className="text-[10px] font-bold uppercase text-mute">Fees</p>
                  <p className={`font-bold text-sm ${selected.fees_cleared ? "text-emerald-700" : "text-amber-700"}`}>
                    {selected.fees_cleared ? "Cleared" : "Balance"}
                  </p>
                </div>
              </div>

              {!selected.fees_cleared && Object.entries(selected.fee_balance ?? {}).length > 0 && (
                <div className="rounded-lg bg-amber-50 border border-amber-200 p-3">
                  <p className="text-[10px] font-bold uppercase text-amber-700 mb-1">Outstanding Balance</p>
                  {Object.entries(selected.fee_balance).map(([cur, amt]) => (
                    <p key={cur} className="font-black text-amber-900">{cur} {(amt as number).toFixed(2)}</p>
                  ))}
                </div>
              )}

              {selected.guardian && (
                <div className="rounded-lg bg-navy-50 border border-navy-100 p-3">
                  <p className="text-[10px] font-bold uppercase text-navy-700 mb-1">Guardian</p>
                  <p className="font-bold text-sm text-navy-900">{selected.guardian}</p>
                </div>
              )}

              {profileQ.loading && <p className="text-xs text-mute text-center">Loading profile...</p>}
              {profileQ.data?.guardians?.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold uppercase text-mute mb-2">Guardian Details</p>
                  {profileQ.data.guardians.map((g: any, i: number) => (
                    <div key={i} className="text-xs text-slate-700">
                      <span className="font-bold">{g.name}</span> ({g.relationship}){g.phone ? ` - ${g.phone}` : ""}
                    </div>
                  ))}
                </div>
              )}
              {profileQ.data?.recent_marks?.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold uppercase text-mute mb-2">Recent Assessments</p>
                  <div className="space-y-1.5">
                    {profileQ.data.recent_marks.slice(0, 6).map((m: any, i: number) => (
                      <div key={i} className="flex items-center justify-between text-xs">
                        <div className="min-w-0">
                          <p className="font-semibold text-navy-900 truncate">{m.subject}</p>
                          <p className="text-mute truncate">{m.title} &middot; T{m.term}</p>
                        </div>
                        <span className={`ml-2 font-black shrink-0 ${
                          m.absent ? "text-mute" : m.pct != null && m.pct >= 70 ? "text-emerald-700" : m.pct != null && m.pct >= 50 ? "text-navy-700" : "text-crimson-600"
                        }`}>{m.absent ? "ABS" : m.pct != null ? `${m.pct}%` : "\u2014"}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
