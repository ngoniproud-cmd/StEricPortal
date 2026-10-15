import { useState } from "react";
import { Check, Plus, X } from "lucide-react";
import { api, session } from "../lib/api";
import { useFetch } from "../lib/hooks";
import { fmtDate } from "../lib/zim";
import { Badge, Empty, ErrorNote, Field, PageHeader, Select, Spinner, useToast } from "../components/ui";

function Tally({ id }: { id: string }) {
  const q = useFetch(`/notices/${id}/tally`); const toast = useToast();
  if (q.loading) return <Spinner />; if (q.error) return <ErrorNote msg={q.error} />;
  return (<div className="mt-3"><div className="mb-2 flex gap-2 print:hidden"><button className="btn-ghost border border-line !py-1.5" onClick={() => api(`/notices/${id}/remind`, { method: "POST" }).then(r => toast.show(`${r.reminded} families reminded.`)).catch(e => toast.show(e.message))}>Remind those waiting</button>
    <button className="btn-ghost border border-line !py-1.5" onClick={() => window.print()}>Print list</button></div>
    <table className="w-full text-sm"><thead className="text-left text-xs uppercase text-mute"><tr><th className="py-1">Learner</th><th>Response</th></tr></thead><tbody>{q.data.rows.map((r: any) => <tr key={r.student_id} className="border-t border-line"><td className="py-1.5">{r.name} <span className="text-xs text-mute">{r.admission_no}</span></td>
      <td>{r.response ? <Badge tone={r.response === "agree" ? "green" : "red"}>{r.response === "agree" ? "Agreed" : "Declined"} · {fmtDate(r.responded_at)}</Badge> : <Badge tone="amber">Waiting</Badge>}</td></tr>)}</tbody></table>{toast.node}</div>);
}

export default function Notices() {
  const role = session.role(); const staff = role === "teacher" || role === "admin"; const q = useFetch("/notices"); const classes = useFetch(staff ? "/classes" : null); const toast = useToast();
  const [show, setShow] = useState(false); const [f, setF] = useState<any>({}); const [err, setErr] = useState(""); const [open, setOpen] = useState("");
  const set = (k: string) => (v: string) => setF((s: any) => ({ ...s, [k]: v }));
  async function create() { setErr(""); try { await api("/notices", { method: "POST", json: { title: f.title, body: f.body, deadline: f.deadline || null, class_id: f.class_id || null } }); setShow(false); setF({}); q.reload(); } catch (e) { setErr((e as Error).message); } }
  async function respond(n: any, response: string) { try { await api(`/notices/${n.id}/respond`, { method: "POST", json: { student_id: n.student.id, response } }); toast.show(response === "agree" ? "Thank you. Permission given." : "Your answer has been recorded."); q.reload(); } catch (e) { toast.show((e as Error).message); } }
  return (
    <div className="mx-auto max-w-3xl page-enter"><PageHeader eyebrow="Permission" title="Notices">{staff && <button className="btn-primary" onClick={() => setShow(s => !s)}><Plus size={16} />New notice</button>}</PageHeader>
      {staff && show && <div className="card mb-6 space-y-3 p-5"><Field label="Title"><input className="input" value={f.title ?? ""} onChange={e => set("title")(e.target.value)} /></Field>
        <Field label="Details (what, when, cost, what to bring)"><textarea className="input min-h-24" value={f.body ?? ""} onChange={e => set("body")(e.target.value)} /></Field>
        <div className="grid gap-3 sm:grid-cols-2"><Field label="Send to"><Select value={f.class_id} onChange={set("class_id")}>{role === "admin" && <option value="">Whole school</option>}{role === "teacher" && <option value="">Choose a class…</option>}{(classes.data ?? []).map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></Field>
          <Field label="Reply by (optional)"><input type="date" className="input" value={f.deadline ?? ""} onChange={e => set("deadline")(e.target.value)} /></Field></div>
        <div className="flex items-center gap-3"><button className="btn-primary" disabled={(f.title ?? "").length < 3 || (f.body ?? "").length < 3 || (role === "teacher" && !f.class_id)} onClick={create}>Send notice</button><ErrorNote msg={err} /></div></div>}
      {q.loading ? <Spinner /> : q.error ? <ErrorNote msg={q.error} /> : !q.data.length ? <Empty title="No notices" /> : <div className="space-y-3">{q.data.map((n: any) => (
        <article key={n.id + (n.student?.id ?? "")} className="card p-5"><div className="flex flex-wrap items-start justify-between gap-2"><h2 className="font-display text-lg text-navy-800">{n.title}</h2>
          {staff ? <div className="flex gap-1.5"><Badge tone="green">{n.agree} agreed</Badge><Badge tone="red">{n.decline} declined</Badge><Badge tone="amber">{n.waiting} waiting</Badge></div> : n.response && <Badge tone={n.response === "agree" ? "green" : "red"}>{n.response === "agree" ? "You agreed" : "You declined"}</Badge>}</div>
          <p className="mt-2 whitespace-pre-line text-sm">{n.body}</p><p className="mt-2 text-xs text-mute">{staff ? n.audience : `For ${n.student.name}`}{n.deadline ? ` · reply by ${fmtDate(n.deadline)}` : ""}</p>
          {staff ? <><button className="btn-ghost mt-2 border border-line !py-1.5" onClick={() => setOpen(open === n.id ? "" : n.id)}>{open === n.id ? "Hide" : "See who has replied"}</button>{open === n.id && <Tally id={n.id} />}</> :
            n.can_respond && (n.closed ? <p className="mt-3 text-sm text-mute">Replies are closed.</p> : <div className="mt-3 flex gap-2"><button className="btn-primary" onClick={() => respond(n, "agree")}><Check size={16} />Agree</button><button className="btn-ghost border border-red-200 text-red-700" onClick={() => respond(n, "decline")}><X size={16} />Decline</button></div>)}</article>))}</div>}{toast.node}</div>
  );
}
