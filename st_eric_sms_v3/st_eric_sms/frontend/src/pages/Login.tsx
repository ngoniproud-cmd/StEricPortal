import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { login } from "../lib/api";
import { ErrorNote, Logo } from "../components/ui";

export default function Login() {
  const nav = useNavigate(); const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setBusy(true); setErr(""); const f = new FormData(e.currentTarget);
    try { const d = await login(String(f.get("u")), String(f.get("p"))); nav(d.must_change_password ? "/change-password" : "/dashboard"); }
    catch (x) { setErr((x as Error).message); } finally { setBusy(false); }
  }
  return (
    <div className="grid min-h-screen md:grid-cols-[1.1fr_1fr]">
      <div className="relative hidden flex-col justify-between overflow-hidden bg-navy-800 p-12 text-white md:flex">
        <div className="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full border border-gold-500/20" />
        <div className="pointer-events-none absolute -bottom-40 -left-24 h-[28rem] w-[28rem] rounded-full border border-white/10" />
        <Logo size={64} />
        <div className="relative"><h1 className="font-display text-5xl leading-[1.1]">St Eric<br />High School</h1><div className="mt-5 h-1 w-20 bg-gold-500" />
          <p className="mt-6 max-w-sm text-lg text-navy-200">Results, attendance, library and school news in one place.</p></div>
        <p className="relative text-xs text-navy-300">Stand No 2395, Shonhiwa Drive, Norton · 062-2087 · 062-2200</p>
      </div>
      <div className="flex items-center justify-center p-6">
        <form onSubmit={submit} className="card w-full max-w-sm space-y-5 p-8">
          <div className="md:hidden"><Logo size={48} /></div>
          <div><h2 className="font-display text-2xl text-navy-800">Welcome back</h2><p className="mt-1 text-sm text-mute">Sign in with the username the school gave you.</p></div>
          <div><label className="label" htmlFor="u">Username</label><input id="u" name="u" className="input" autoComplete="username" autoCapitalize="none" required /></div>
          <div><label className="label" htmlFor="p">Password</label><input id="p" name="p" type="password" className="input" autoComplete="current-password" required /></div>
          <ErrorNote msg={err} />
          <button className="btn-primary w-full" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
          <p className="text-center text-xs text-mute">Forgot your password? Ask the school office to reset it.</p>
          <a href="/apply" className="block text-center text-sm font-medium text-navy-600 hover:underline">Applying for a place? Start here</a>
        </form>
      </div>
    </div>
  );
}
