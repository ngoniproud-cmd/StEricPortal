import { useState } from "react";
import { RefreshCw, Upload } from "lucide-react";
import { api, session, upload } from "../lib/api";
import { useFetch } from "../lib/hooks";
import { Badge, Empty, ErrorNote, PageHeader, Spinner, useToast } from "../components/ui";

const money = (n: number, c: string) => `${c === "USD" ? "US$" : "ZWG$"}${n.toLocaleString("en-US", { minimumFractionDigits: 2 })}`;
const ago = (iso: string | null) => { if (!iso) return ""; const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000); return m < 1 ? "just now" : m < 60 ? `${m} minutes ago` : m < 1440 ? `${Math.round(m / 60)} hours ago` : `${Math.round(m / 1440)} days ago`; };

export default function Fees() {
  const admin = session.role() === "admin"; const q = useFetch(admin ? null : "/fees/mine"); const toast = useToast(); const [res, setRes] = useState<any>(null);
  const show = (r: any) => { setRes(r); toast.show(`${r.created} new, ${r.updated} updated${r.errors.length ? `, ${r.errors.length} rows skipped` : ""}.`); };
  return (
    <div className="mx-auto max-w-3xl"><PageHeader eyebrow="Accounts" title="Fees" sub={admin ? "Balances are copied from the school's fee system. This site never takes payments." : "Balances come from the school's fee system. Payments are made at the bursar's office."}>
      {admin && <><button className="btn-ghost border border-line" onClick={() => api("/fees/sync", { method: "POST" }).then(show).catch(e => toast.show(e.message))}><RefreshCw size={16} />Sync now</button>
        <label className="btn-primary cursor-pointer"><Upload size={16} />Import CSV<input hidden type="file" accept=".csv" onChange={e => { const f = e.target.files?.[0]; if (f) { const fd = new FormData(); fd.append("file", f); upload("/fees/import", fd).then(show).catch(x => toast.show(x.message)); e.target.value = ""; } }} /></label></>}</PageHeader>
      {admin ? <div className="card space-y-2 p-5 text-sm"><p>Use <b>Sync now</b> once the fee system connection is set up, or <b>Import CSV</b> with the columns:</p>
        <code className="block rounded bg-paper p-3 text-xs">external_student_id, external_fee_id, fee_type, currency, amount_due, amount_paid</code><p className="text-mute">The student ID must match the learner's admission number. Importing again updates existing lines.</p>
        {res?.errors?.slice(0, 6).map((e: any) => <p key={e.row} className="text-red-700">Row {e.row}: {e.error}</p>)}</div> :
        q.loading ? <Spinner /> : q.error ? <ErrorNote msg={q.error} /> : !q.data.length ? <Empty title="No learner linked" /> : <div className="space-y-5">{q.data.map((s: any) => (
          <section key={s.student.id} className="card overflow-hidden"><div className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-navy-50 px-5 py-4"><div><p className="font-display text-lg text-navy-800">{s.student.name}</p><p className="text-xs text-mute">{s.last_synced_at ? `Last updated ${ago(s.last_synced_at)}` : "No fee records yet"}</p></div>
            <div className="text-right"><p className="label !mb-0">Balance</p><p className="font-display text-2xl text-navy-800">{Object.keys(s.balance).length ? Object.entries(s.balance).map(([c, v]: any) => money(v, c)).join(" + ") : "–"}</p></div></div>
            {s.records.length ? <table className="w-full text-sm"><thead className="text-left text-xs uppercase text-mute"><tr><th className="px-5 py-2">Item</th><th>Charged</th><th>Paid</th><th className="pr-5 text-right">Status</th></tr></thead><tbody>{s.records.map((r: any, i: number) => <tr key={i} className="border-t border-line"><td className="px-5 py-2.5 font-medium">{r.fee_type}</td><td>{money(r.due, r.currency)}</td><td>{money(r.paid, r.currency)}</td>
              <td className="pr-5 text-right"><Badge tone={r.status === "paid" ? "green" : r.status === "part_paid" ? "amber" : "red"}>{r.status === "paid" ? "Paid" : r.status === "part_paid" ? "Part paid" : "Unpaid"}</Badge></td></tr>)}</tbody></table> : <p className="p-5 text-sm text-mute">Nothing to show yet.</p>}</section>))}</div>}{toast.node}</div>
  );
}
