import { FormEvent, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { api, session } from "../lib/api";
import { ErrorNote, Logo } from "../components/ui";

export default function ChangePassword() {
  const nav = useNavigate(); const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  if (!session.token()) return <Navigate to="/login" replace />;
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); const f = new FormData(e.currentTarget); setErr("");
    if (f.get("n") !== f.get("c")) return setErr("The new passwords do not match.");
    setBusy(true);
    try { await api("/auth/change-password", { method: "POST", json: { current_password: f.get("o"), new_password: f.get("n") } }); session.passwordChanged(); nav("/dashboard"); }
    catch (x) { setErr((x as Error).message); } finally { setBusy(false); }
  }
  return (
    <div className="grid min-h-screen place-items-center p-6"><form onSubmit={submit} className="card w-full max-w-sm space-y-4 p-8">
      <Logo size={48} /><div><h1 className="font-display text-2xl text-navy-800">Choose your own password</h1><p className="mt-1 text-sm text-mute">For your safety, replace the temporary password. Use at least 8 characters.</p></div>
      <div><label className="label">Temporary password</label><input name="o" type="password" className="input" required autoComplete="current-password" /></div>
      <div><label className="label">New password</label><input name="n" type="password" className="input" minLength={8} required autoComplete="new-password" /></div>
      <div><label className="label">Repeat new password</label><input name="c" type="password" className="input" minLength={8} required autoComplete="new-password" /></div>
      <ErrorNote msg={err} /><button className="btn-primary w-full" disabled={busy}>{busy ? "Saving…" : "Save and continue"}</button></form></div>
  );
}
