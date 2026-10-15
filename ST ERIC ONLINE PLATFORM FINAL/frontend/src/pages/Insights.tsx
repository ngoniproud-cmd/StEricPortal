import { useState } from "react";
import { useFetch } from "../lib/hooks";
import { currentTerm, currentYear } from "../lib/zim";
import { Badge, Empty, ErrorNote, Field, PageHeader, Select, Spinner } from "../components/ui";

const TONE = { high: "red", medium: "amber", low: "green" } as const;
const LABEL = { high: "Needs support now", medium: "Keep an eye on", low: "On track" } as const;

export default function Insights() {
  const classes = useFetch("/classes"); const [cid, setCid] = useState(""); const [term, setTerm] = useState(String(currentTerm())); const [year, setYear] = useState(String(currentYear()));
  const q = useFetch(cid ? `/insights/class/${cid}?term=${term}&year=${year}` : null);
  const list: any[] = q.data ?? [];
  return (
    <div className="mx-auto max-w-3xl page-enter"><PageHeader eyebrow="Early Warning" title="Learner Insights" />
      <div className="card mb-5 grid gap-3 p-4 sm:grid-cols-3"><Field label="Class"><Select value={cid} onChange={setCid}><option value="">Choose…</option>{(classes.data ?? []).map((c: any) => <option key={c.id} value={c.id}>{c.name} ({c.year})</option>)}</Select></Field>
        <Field label="Term"><Select value={term} onChange={setTerm}>{[1, 2, 3].map(t => <option key={t}>{t}</option>)}</Select></Field><Field label="Year"><input className="input" type="number" value={year} onChange={e => setYear(e.target.value)} /></Field></div>
      {q.loading ? <Spinner /> : q.error ? <ErrorNote msg={q.error} /> : !cid ? <Empty title="Choose a class" /> : !list.length ? <Empty title="No learners in this class" /> : (
        <div className="space-y-3">{list.map(s => <div key={s.student_id} className="card p-4"><div className="flex items-center justify-between gap-3"><p className="font-medium">{s.name}</p><Badge tone={TONE[s.risk as keyof typeof TONE]}>{LABEL[s.risk as keyof typeof LABEL]}</Badge></div>
          {s.flags.length > 0 ? <ul className="mt-2 space-y-1 text-sm text-mute">{s.flags.map((f: string) => <li key={f} className="flex gap-2"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-crimson-600" />{f}</li>)}</ul> : <p className="mt-1 text-sm text-mute">No concerns found from the marks and attendance recorded so far.</p>}</div>)}</div>)}
    </div>
  );
}
