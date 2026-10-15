import { FormEvent, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { ErrorNote, Field, Logo } from "../components/ui";

export default function Apply() {
  const [ref, setRef] = useState(""); const [err, setErr] = useState(""); const [busy, setBusy] = useState(false); const [st, setSt] = useState<any>(null); const [stErr, setStErr] = useState("");
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setBusy(true); setErr(""); const fd = new FormData(e.currentTarget);
    for (const k of ["birth_cert", "last_report"]) { const f = fd.get(k) as File; if (f && !f.size) fd.delete(k); }
    try { const r = await fetch("/api/v1/public/applications", { method: "POST", body: fd }); const b = await r.json(); if (!r.ok) throw new Error(typeof b.detail === "string" ? b.detail : (b.detail ?? []).map((x: any) => x.msg).join(". ")); setRef(b.reference); }
    catch (x) { setErr((x as Error).message || "Could not send the application."); } finally { setBusy(false); } }
  async function check(e: FormEvent<HTMLFormElement>) { e.preventDefault(); setStErr(""); setSt(null); const f = new FormData(e.currentTarget);
    const r = await fetch(`/api/v1/public/applications/status?reference=${encodeURIComponent(String(f.get("r")))}&phone=${encodeURIComponent(String(f.get("p")))}`); const b = await r.json();
    r.ok ? setSt(b) : setStErr(typeof b.detail === "string" ? b.detail : "Could not check."); }
  return (
    <div className="min-h-screen bg-paper"><header className="bg-navy-800 px-6 py-5 text-white"><div className="mx-auto flex max-w-3xl items-center gap-4"><Logo size={48} /><div><h1 className="font-display text-xl">St Eric High School</h1><p className="text-sm text-navy-200">Apply for a place · Form 1 and Form 5</p></div></div></header>
      <main className="mx-auto max-w-3xl space-y-6 p-4 md:p-8">
        {ref ? <div className="card p-8 text-center"><CheckCircle2 className="mx-auto text-emerald-600" size={48} /><h2 className="mt-3 font-display text-2xl text-navy-800">Application received</h2>
          <p className="mt-2 text-mute">Your reference number is</p><p className="my-3 select-all font-mono text-2xl font-semibold text-navy-800">{ref}</p><p className="text-sm text-mute">Keep it safe. Use it with your phone number below to check progress. The school will contact you.</p></div> :
          <form onSubmit={submit} className="card grid gap-4 p-6 sm:grid-cols-2">
            <div className="sm:col-span-2"><h2 className="font-display text-xl text-navy-800">Learner</h2></div>
            <Field label="First name"><input name="first_name" className="input" required /></Field><Field label="Surname"><input name="last_name" className="input" required /></Field>
            <Field label="Date of birth"><input name="date_of_birth" type="date" className="input" required /></Field>
            <Field label="Gender"><select name="gender" className="input"><option value="">–</option><option value="F">Female</option><option value="M">Male</option></select></Field>
            <Field label="Applying for"><select name="intake_form" className="input" required><option value="1">Form 1</option><option value="5">Form 5 (A-Level)</option></select></Field>
            <Field label="Previous school"><input name="previous_school" className="input" /></Field>
            <div className="sm:col-span-2"><Field label="Subjects of interest (Form 5)"><input name="subjects_interest" className="input" placeholder="e.g. Mathematics, Physics, Chemistry" /></Field></div>
            <div className="sm:col-span-2 pt-2"><h2 className="font-display text-xl text-navy-800">Parent or guardian</h2></div>
            <Field label="Full name"><input name="guardian_name" className="input" required /></Field><Field label="Phone (+263…)"><input name="guardian_phone" className="input" placeholder="+263771234567" pattern="\+263\d{9}" title="Format: +263771234567" required /></Field>
            <div className="sm:col-span-2"><Field label="Email (optional)"><input name="guardian_email" type="email" className="input" /></Field></div>
            <Field label="Birth certificate (PDF or photo)"><input name="birth_cert" type="file" accept=".pdf,.png,.jpg,.jpeg" className="input" /></Field>
            <Field label="Last school report (PDF or photo)"><input name="last_report" type="file" accept=".pdf,.png,.jpg,.jpeg" className="input" /></Field>
            <input name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" />
            <div className="sm:col-span-2 space-y-3"><ErrorNote msg={err} /><button className="btn-primary w-full sm:w-auto" disabled={busy}>{busy ? "Sending…" : "Send application"}</button></div></form>}
        <form onSubmit={check} className="card grid gap-3 p-6 sm:grid-cols-[1fr_1fr_auto] sm:items-end"><div className="sm:col-span-3"><h2 className="font-display text-lg text-navy-800">Already applied? Check progress</h2></div>
          <Field label="Reference"><input name="r" className="input" placeholder="SE-2026-ABC123" required /></Field><Field label="Guardian phone"><input name="p" className="input" placeholder="+263…" required /></Field><button className="btn-primary">Check</button>
          <div className="sm:col-span-3">{st && <p className="rounded-lg bg-navy-50 p-3 text-sm"><b>{st.name}</b> (Form {st.intake_form}): <b className="capitalize">{st.status.replace("_", " ")}</b></p>}<ErrorNote msg={stErr} /></div></form>
      </main></div>
  );
}
