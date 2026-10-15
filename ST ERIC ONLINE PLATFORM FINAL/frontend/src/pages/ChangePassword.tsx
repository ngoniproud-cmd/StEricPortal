import { FormEvent, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { Eye, EyeOff, KeyRound, Lock, LogOut, ShieldAlert } from "lucide-react";
import { api, session } from "../lib/api";
import { ErrorNote } from "../components/ui";

export default function ChangePassword() {
  const nav = useNavigate();
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);

  if (!session.token()) return <Navigate to="/login" replace />;

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setErr("");
    const newPwd = String(f.get("n") || "");
    const confirmPwd = String(f.get("c") || "");

    if (newPwd !== confirmPwd) {
      return setErr("The new passwords do not match. Please re-enter.");
    }
    if (newPwd.length < 6) {
      return setErr("Your new password must be at least 6 characters long.");
    }

    setBusy(true);
    try {
      await api("/auth/change-password", {
        method: "POST",
        json: { current_password: f.get("o"), new_password: newPwd },
      });
      session.passwordChanged();
      nav("/dashboard");
    } catch (x) {
      setErr((x as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const role = session.role();
  const name = session.name();

  return (
    <div className="min-h-screen bg-[#f1f5f9] flex flex-col justify-between selection:bg-[#0d1f3d] selection:text-white">
      {/* Header with Circular Gradient Orbs */}
      <header className="bg-white border-b-2 border-slate-200 relative overflow-hidden shadow-xs">
        <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-1/3 overflow-hidden hidden sm:block">
          <div className="absolute -top-12 -right-12 h-56 w-56 rounded-full border-[14px] border-[#0d1f3d]/10" />
          <div className="absolute top-2 right-12 h-36 w-36 rounded-full bg-gradient-to-br from-[#c41e2a]/15 to-[#dba83a]/20 blur-sm" />
        </div>

        <div className="mx-auto max-w-5xl px-4 sm:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-xl bg-white p-1.5 border border-slate-200 shadow-xs flex items-center justify-center">
              <img src="/logo-white.png" alt="St Eric High School" className="h-full w-full object-contain" />
            </div>
            <div>
              <h1 className="text-xl font-black text-[#0d1f3d] tracking-tight uppercase leading-none font-display">
                St Eric High School
              </h1>
              <p className="text-xs font-bold text-[#c41e2a] uppercase tracking-wider mt-1">
                Account Security Setup
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              session.clear();
              nav("/login");
            }}
            className="flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100 cursor-pointer"
          >
            <LogOut size={14} /> Sign Out
          </button>
        </div>

        <div className="h-1 w-full flex">
          <div className="w-1/2 bg-[#0d1f3d]" />
          <div className="w-1/4 bg-[#c41e2a]" />
          <div className="w-1/4 bg-[#dba83a]" />
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-8">
        <div className="w-full max-w-md">
          {/* Card with Distinct Outline */}
          <form
            onSubmit={submit}
            className="bg-white rounded-2xl border-2 border-[#0d1f3d] shadow-md p-6 sm:p-10 space-y-5 ring-4 ring-navy-100/40 animate-fade-in"
          >
            <div className="text-center">
              <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full bg-crimson-100 text-crimson-700">
                <KeyRound size={24} />
              </div>
              <h2 className="text-xl font-black text-[#0d1f3d] tracking-tight uppercase">
                First-Time Password Change
              </h2>
              <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                Welcome, <b className="text-slate-800">{name}</b> ({role}). For your account security, you must replace your initial temporary password before continuing to the portal.
              </p>
            </div>

            <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3 text-xs text-amber-900 flex items-start gap-2.5">
              <ShieldAlert size={16} className="text-amber-700 shrink-0 mt-0.5" />
              <span>
                Your initial password was your <b>SURNAME in CAPITAL letters</b>. Set a private password that only you know.
              </span>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                Initial / Temporary Password
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock size={16} />
                </span>
                <input
                  name="o"
                  type={showCurrent ? "text" : "password"}
                  className="w-full rounded-lg border border-slate-300 bg-white pl-10 pr-10 py-2.5 text-sm text-slate-900 focus:border-[#0d1f3d] focus:outline-none focus:ring-2 focus:ring-navy-100"
                  placeholder="e.g. MOYO"
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrent(s => !s)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  {showCurrent ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                New Secure Password
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <KeyRound size={16} />
                </span>
                <input
                  name="n"
                  type={showNew ? "text" : "password"}
                  className="w-full rounded-lg border border-slate-300 bg-white pl-10 pr-10 py-2.5 text-sm text-slate-900 focus:border-[#0d1f3d] focus:outline-none focus:ring-2 focus:ring-navy-100"
                  placeholder="At least 6 characters"
                  minLength={6}
                  required
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowNew(s => !s)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                Confirm New Password
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <KeyRound size={16} />
                </span>
                <input
                  name="c"
                  type={showNew ? "text" : "password"}
                  className="w-full rounded-lg border border-slate-300 bg-white pl-10 pr-4 py-2.5 text-sm text-slate-900 focus:border-[#0d1f3d] focus:outline-none focus:ring-2 focus:ring-navy-100"
                  placeholder="Re-enter your new password"
                  minLength={6}
                  required
                  autoComplete="new-password"
                />
              </div>
            </div>

            <ErrorNote msg={err} />

            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-lg bg-[#0d1f3d] hover:bg-[#1a3563] text-white font-extrabold text-sm uppercase tracking-wider py-3 px-4 transition shadow-xs disabled:opacity-50 cursor-pointer text-center"
            >
              {busy ? "Updating Password..." : "Set Password & Proceed to Portal"}
            </button>
          </form>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-3 px-4 text-center text-xs text-slate-500">
        St Eric High School · Online Administration Platform · Norton, Zimbabwe
      </footer>
    </div>
  );
}
