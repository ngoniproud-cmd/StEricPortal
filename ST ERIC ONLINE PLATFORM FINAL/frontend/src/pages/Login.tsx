import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  Eye,
  EyeOff,
  FileSearch,
  HelpCircle,
  Lock,
  LogIn,
  Phone,
  User,
  UserPlus,
} from "lucide-react";
import { login, session } from "../lib/api";
import { ErrorNote, Field } from "../components/ui";

export default function Login() {
  const nav = useNavigate();
  const [activeTab, setActiveTab] = useState<"login" | "track" | "apply" | "help">("login");

  // Login form state
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  // Application tracking state
  const [trackRef, setTrackRef] = useState("");
  const [trackPhone, setTrackPhone] = useState("");
  const [trackResult, setTrackResult] = useState<any>(null);
  const [trackErr, setTrackErr] = useState("");
  const [trackBusy, setTrackBusy] = useState(false);

  // New Application form state
  const [applyRef, setApplyRef] = useState("");
  const [applyErr, setApplyErr] = useState("");
  const [applyBusy, setApplyBusy] = useState(false);
  const [applyIntakeForm, setApplyIntakeForm] = useState("1");
  const [applySubjectsInterest, setApplySubjectsInterest] = useState("");

  async function submitLogin(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    try {
      const d = await login(username, password);
      nav(d.must_change_password ? "/change-password" : "/dashboard");
    } catch (x) {
      setErr((x as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function submitTrack(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setTrackBusy(true);
    setTrackErr("");
    setTrackResult(null);
    try {
      const r = await fetch(
        `/api/v1/public/applications/status?reference=${encodeURIComponent(trackRef)}&phone=${encodeURIComponent(trackPhone)}`
      );
      const b = await r.json();
      if (!r.ok) {
        throw new Error(typeof b.detail === "string" ? b.detail : "Could not locate application.");
      }
      setTrackResult(b);
    } catch (x) {
      setTrackErr((x as Error).message);
    } finally {
      setTrackBusy(false);
    }
  }

  async function submitApply(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setApplyBusy(true);
    setApplyErr("");
    const fd = new FormData(e.currentTarget);
    const bc = fd.get("birth_cert") as File;
    const lr = fd.get("last_report") as File;
    if (!bc || !bc.size) {
      setApplyErr("Please upload the prospective learner's birth certificate (PDF or Image).");
      setApplyBusy(false);
      return;
    }
    if (!lr || !lr.size) {
      setApplyErr("Please upload the previous school report card or documentation (PDF or Image).");
      setApplyBusy(false);
      return;
    }
    try {
      const r = await fetch("/api/v1/public/applications", { method: "POST", body: fd });
      const b = await r.json();
      if (!r.ok) {
        throw new Error(typeof b.detail === "string" ? b.detail : (b.detail ?? []).map((x: any) => x.msg).join(". "));
      }
      setApplyRef(b.reference);
    } catch (x) {
      setApplyErr((x as Error).message || "Could not submit application. Please review fields.");
    } finally {
      setApplyBusy(false);
    }
  }

  const tabs = [
    { id: "login" as const, label: "Portal Login", icon: LogIn },
    { id: "apply" as const, label: "New Application", icon: UserPlus },
    { id: "track" as const, label: "Track Application", icon: FileSearch },
    { id: "help" as const, label: "Help & Support", icon: HelpCircle },
  ];

  return (
    <div className="min-h-screen bg-[#f1f5f9] font-sans flex flex-col selection:bg-[#0d1f3d] selection:text-white">
      {/* ═══════════════════════════════════════════════════════════
          HEADER — identical look on all screens, scales gracefully
         ═══════════════════════════════════════════════════════════ */}
      <header className="bg-white border-b-2 border-slate-200 relative overflow-hidden shadow-xs z-20">
        {/* Geometric shapes — visible on md+ */}
        <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-3/5 lg:w-1/2 overflow-hidden hidden md:block z-0">
          <div
            className="absolute inset-y-0 right-0 w-full bg-[#0d1f3d]"
            style={{ clipPath: "polygon(28% 0%, 100% 0%, 100% 100%, 0% 100%)" }}
          />
          <div
            className="absolute inset-y-0 right-0 w-full bg-gradient-to-r from-[#dba83a] to-[#c48e24] opacity-95"
            style={{ clipPath: "polygon(22% 0%, 28% 0%, 0% 100%, 0% 100%)" }}
          />
          <div
            className="absolute inset-y-0 right-0 w-full bg-[#c41e2a]"
            style={{ clipPath: "polygon(17% 0%, 21% 0%, 0% 70%, 0% 50%)" }}
          />
          <div
            className="absolute top-0 right-1/4 w-32 h-full bg-white/5"
            style={{ clipPath: "polygon(50% 0%, 100% 0%, 50% 100%, 0% 100%)" }}
          />
          <div
            className="absolute -bottom-6 right-16 w-48 h-24 bg-[#dba83a]/20"
            style={{ clipPath: "polygon(20% 0%, 100% 0%, 80% 100%, 0% 100%)" }}
          />
        </div>

        {/* Mobile: mini navy accent strip on right side for visual polish */}
        <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-2 bg-gradient-to-b from-[#0d1f3d] via-[#c41e2a] to-[#dba83a] md:hidden" />

        {/* Header Content */}
        <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-4 sm:py-5 md:py-6">
          <div className="flex items-center justify-between gap-4">
            {/* Left: Logo + School Info */}
            <div className="flex items-center gap-3 sm:gap-5 md:gap-7 min-w-0">
              <div className="h-14 w-14 sm:h-20 sm:w-20 md:h-28 md:w-28 rounded-xl sm:rounded-2xl bg-white p-1.5 sm:p-2 border-2 border-slate-200 shadow-sm flex items-center justify-center shrink-0">
                <img
                  src="/logo-white.png"
                  alt="St Eric High School Crest"
                  className="h-full w-full object-contain"
                />
              </div>

              <div className="min-w-0">
                <h1 className="text-base sm:text-2xl md:text-4xl font-black text-[#0d1f3d] tracking-tight uppercase leading-tight font-display truncate">
                  St Eric High School
                </h1>

                <div className="mt-1 sm:mt-2 flex items-center gap-2 sm:gap-3 flex-wrap">
                  <span className="text-[10px] sm:text-xs md:text-sm font-extrabold tracking-widest text-[#c41e2a] uppercase">
                    Service and Excellence
                  </span>
                  <span className="text-slate-300 hidden sm:inline">|</span>
                  <span className="text-[10px] sm:text-xs font-semibold text-slate-500 uppercase tracking-wider hidden sm:inline">
                    Norton, Zimbabwe
                  </span>
                </div>

                <div className="mt-1 sm:mt-2 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[10px] sm:text-xs text-slate-500 font-medium">
                  <span className="hidden sm:inline">Stand No 2395, Shonhiwa Drive, Norton</span>
                  <span className="hidden md:inline text-slate-300">·</span>
                  <span className="flex items-center gap-1">
                    <Phone size={10} className="text-[#c41e2a] sm:hidden" />
                    <Phone size={12} className="text-[#c41e2a] hidden sm:block" />
                    <span>062-2087 / 062-2200</span>
                  </span>
                </div>
              </div>
            </div>

            {/* Right: Year badge — always visible */}
            <div className="shrink-0 flex flex-col items-end text-right">
              <span className="text-[8px] sm:text-[10px] md:text-[11px] font-black uppercase tracking-[0.2em] sm:tracking-[0.25em] text-[#dba83a]">
                Academic Year
              </span>
              <span className="text-2xl sm:text-4xl md:text-5xl lg:text-6xl font-black tracking-tight text-[#0d1f3d] md:text-white leading-none mt-0.5 font-display md:drop-shadow-md">
                2026
              </span>
              <div className="h-1 sm:h-1.5 w-12 sm:w-16 md:w-20 bg-gradient-to-r from-[#dba83a] to-[#c41e2a] rounded-full mt-1 sm:mt-2" />
            </div>
          </div>
        </div>

        {/* Bottom accent strip */}
        <div className="relative h-1 sm:h-1.5 w-full flex">
          <div className="w-1/2 bg-[#0d1f3d]" />
          <div className="w-1/4 bg-[#c41e2a]" />
          <div className="w-1/4 bg-[#dba83a]" />
        </div>
      </header>

      {/* ═══════════════════════════════════════════════════════════
          MAIN CONTENT
         ═══════════════════════════════════════════════════════════ */}
      <main className="flex-1 mx-auto w-full max-w-7xl px-3 sm:px-6 lg:px-8 py-5 sm:py-8 md:py-12">
        <div className="grid md:grid-cols-[240px_1fr] lg:grid-cols-[260px_1fr] gap-5 lg:gap-8 items-start">
          {/* ─── LEFT: Desktop sidebar nav (hidden on mobile) ─── */}
          <aside className="hidden md:block w-full">
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden sticky top-6">
              <div className="bg-[#0d1f3d] px-5 py-4">
                <h3 className="text-xs font-black uppercase tracking-wider text-white">
                  Quick Navigation
                </h3>
              </div>
              <nav className="divide-y divide-slate-100 bg-white">
                {tabs.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => { setActiveTab(item.id); setErr(""); }}
                      className={`w-full text-left px-5 py-4 text-xs font-bold transition flex items-center justify-between cursor-pointer ${
                        isActive
                          ? "bg-slate-50 text-[#0d1f3d] border-l-4 border-[#c41e2a]"
                          : "text-slate-700 hover:bg-slate-50 hover:text-[#0d1f3d] border-l-4 border-transparent"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Icon size={16} className={isActive ? "text-[#c41e2a]" : "text-slate-400"} />
                        <span>{item.label}</span>
                      </div>
                      <ChevronRight
                        size={14}
                        className={isActive ? "text-[#0d1f3d]" : "text-slate-300"}
                      />
                    </button>
                  );
                })}
              </nav>
            </div>
          </aside>

          {/* ─── MOBILE: Horizontal tab strip (shown only on mobile) ─── */}
          <div className="md:hidden -mx-3 px-3 overflow-x-auto scrollbar-none">
            <div className="flex gap-2 pb-1 min-w-max">
              {tabs.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => { setActiveTab(item.id); setErr(""); }}
                    className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-[11px] font-bold whitespace-nowrap transition cursor-pointer ${
                      isActive
                        ? "bg-[#0d1f3d] text-white shadow-sm"
                        : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    <Icon size={13} className={isActive ? "text-[#dba83a]" : "text-slate-400"} />
                    {item.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* ─── RIGHT: Main content card ─── */}
          <div className="w-full">
            <div className="rounded-xl sm:rounded-2xl p-[2px] sm:p-[3px] bg-gradient-to-br from-[#0d1f3d] via-[#1a3563] to-[#c41e2a] shadow-lg sm:shadow-xl">
              <div className="bg-white rounded-[10px] sm:rounded-[13px] p-5 sm:p-8 md:p-10 lg:p-12 relative overflow-hidden">
                {/* Top accent bar */}
                <div className="absolute top-0 left-0 right-0 h-1 sm:h-1.5 bg-gradient-to-r from-[#0d1f3d] via-[#1a3563] to-[#c41e2a]" />

                {/* ─── TAB: PORTAL LOGIN ─── */}
                {activeTab === "login" && (
                  <div className="animate-fade-in max-w-md mx-auto">
                    <div className="text-center mb-6 sm:mb-8">
                      <h2 className="text-lg sm:text-xl md:text-2xl font-black text-[#0d1f3d] tracking-tight uppercase">
                        Welcome to St Eric Portal
                      </h2>
                      <p className="text-[11px] sm:text-xs text-slate-500 mt-1 font-medium">
                        Sign in to access your student, teacher, or guardian dashboard
                      </p>
                    </div>

                    {session.token() && (
                      <div className="mb-5 sm:mb-6 p-3 sm:p-4 rounded-xl bg-navy-50 border border-navy-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                        <div>
                          <p className="font-bold text-[#0d1f3d]">Already signed in as {session.name()}</p>
                          <p className="text-slate-500 capitalize">{session.role()} account active</p>
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => nav("/dashboard")}
                            className="rounded-lg bg-[#0d1f3d] hover:bg-[#1a3563] text-white font-bold py-1.5 px-3 text-xs cursor-pointer"
                          >
                            Go to Dashboard
                          </button>
                          <button
                            type="button"
                            onClick={() => { session.clear(); setUsername(""); setPassword(""); }}
                            className="rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-bold py-1.5 px-3 text-xs cursor-pointer"
                          >
                            Sign Out
                          </button>
                        </div>
                      </div>
                    )}

                    <form onSubmit={submitLogin} className="space-y-4">
                      <div>
                        <label className="block text-[11px] sm:text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5" htmlFor="username">
                          Username
                        </label>
                        <div className="relative">
                          <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                            <User size={16} />
                          </span>
                          <input
                            id="username"
                            name="username"
                            value={username}
                            onChange={e => setUsername(e.target.value)}
                            className="w-full rounded-lg border border-slate-300 bg-white pl-10 pr-4 py-2.5 text-sm text-slate-900 transition focus:border-[#0d1f3d] focus:outline-none focus:ring-2 focus:ring-navy-100 placeholder:text-slate-400 font-medium"
                            placeholder="Enter your username"
                            autoComplete="username"
                            autoCapitalize="none"
                            required
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-[11px] sm:text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5" htmlFor="password">
                          Password
                        </label>
                        <div className="relative">
                          <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                            <Lock size={16} />
                          </span>
                          <input
                            id="password"
                            name="password"
                            type={showPassword ? "text" : "password"}
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            className="w-full rounded-lg border border-slate-300 bg-white pl-10 pr-10 py-2.5 text-sm text-slate-900 transition focus:border-[#0d1f3d] focus:outline-none focus:ring-2 focus:ring-navy-100 placeholder:text-slate-400 font-medium"
                            placeholder="Enter your password"
                            autoComplete="current-password"
                            required
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(s => !s)}
                            className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                            aria-label={showPassword ? "Hide password" : "Show password"}
                          >
                            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                          </button>
                        </div>
                      </div>

                      <ErrorNote msg={err} />

                      <button
                        type="submit"
                        disabled={busy}
                        className="w-full rounded-lg bg-[#0d1f3d] hover:bg-[#1a3563] text-white font-extrabold text-sm uppercase tracking-wider py-3 px-4 transition shadow-xs disabled:opacity-50 cursor-pointer text-center"
                      >
                        {busy ? "Signing In..." : "Sign In to Portal"}
                      </button>
                    </form>

                    {/* Prominent Apply CTA — visible on all screens */}
                    <div className="mt-6 sm:mt-8 pt-5 sm:pt-6 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => setActiveTab("apply")}
                        className="group w-full overflow-hidden rounded-xl border-2 border-[#c41e2a]/20 bg-gradient-to-r from-red-50 to-white p-4 sm:p-5 transition-all duration-300 hover:border-[#c41e2a]/50 hover:shadow-md cursor-pointer text-left"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-[#c41e2a]">
                              Admissions Open
                            </p>
                            <p className="mt-0.5 sm:mt-1 font-display text-base sm:text-lg text-[#0d1f3d] font-bold">
                              New to St Eric?
                            </p>
                            <p className="mt-0.5 text-[11px] sm:text-sm text-slate-500">
                              Apply for Form 1 or Form 5 enrolment
                            </p>
                          </div>
                          <div className="grid h-10 w-10 sm:h-12 sm:w-12 shrink-0 place-items-center rounded-full bg-[#c41e2a] text-white transition-transform duration-300 group-hover:translate-x-1">
                            <ArrowRight size={18} />
                          </div>
                        </div>
                      </button>
                    </div>

                    <div className="mt-4 sm:mt-6 text-center text-[11px] sm:text-xs text-slate-500">
                      <p>
                        Need help signing in?{" "}
                        <button
                          type="button"
                          onClick={() => setActiveTab("help")}
                          className="text-[#0d1f3d] font-bold hover:underline cursor-pointer"
                        >
                          Contact School Administration
                        </button>
                      </p>
                    </div>
                  </div>
                )}

                {/* ─── TAB: NEW APPLICATION ─── */}
                {activeTab === "apply" && (
                  <div className="animate-fade-in max-w-2xl mx-auto">
                    <div className="text-center mb-6 sm:mb-8">
                      <h2 className="text-lg sm:text-xl md:text-2xl font-black text-[#0d1f3d] tracking-tight uppercase">
                        New Student Enrolment Form
                      </h2>
                      <p className="text-[11px] sm:text-xs text-slate-500 mt-1">
                        Online application for Form 1 and Form 5 (ZIMSEC A-Level)
                      </p>
                    </div>

                    {applyRef ? (
                      <div className="rounded-xl border border-emerald-300 bg-emerald-50/80 p-5 sm:p-8 text-center animate-fade-in">
                        <div className="mx-auto mb-3 grid h-12 w-12 sm:h-14 sm:w-14 place-items-center rounded-full bg-emerald-100 text-emerald-700">
                          <CheckCircle2 size={28} />
                        </div>
                        <h3 className="text-lg sm:text-xl font-bold text-emerald-950">Application Submitted</h3>
                        <p className="text-[11px] sm:text-xs text-slate-600 mt-1">Your official reference number is:</p>
                        <p className="my-3 font-mono text-xl sm:text-2xl font-black text-[#0d1f3d] bg-white py-2 px-4 sm:px-5 rounded-lg border border-slate-200 inline-block shadow-2xs break-all">
                          {applyRef}
                        </p>
                        <p className="text-[11px] sm:text-xs text-slate-500 max-w-md mx-auto">
                          Please save this reference number. Use it together with your guardian phone number on the "Track Application" tab to check progress.
                        </p>
                        <div className="mt-5 sm:mt-6 flex flex-col sm:flex-row justify-center gap-2 sm:gap-3">
                          <button
                            type="button"
                            onClick={() => setApplyRef("")}
                            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
                          >
                            Submit Another
                          </button>
                          <button
                            type="button"
                            onClick={() => setActiveTab("login")}
                            className="rounded-lg bg-[#0d1f3d] px-5 py-2 text-xs font-bold text-white hover:bg-[#1a3563] cursor-pointer"
                          >
                            Return to Login
                          </button>
                        </div>
                      </div>
                    ) : (
                      <form onSubmit={submitApply} className="space-y-5 sm:space-y-6">
                        <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 sm:p-5 space-y-4">
                          <h3 className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-[#0d1f3d]">
                            1. Prospective Learner Information
                          </h3>
                          <div className="grid sm:grid-cols-2 gap-3 sm:gap-4">
                            <Field label="First Name">
                              <input name="first_name" className="input" placeholder="e.g. Tinashe" required />
                            </Field>
                            <Field label="Surname">
                              <input name="last_name" className="input" placeholder="e.g. Moyo" required />
                            </Field>
                            <Field label="Date of Birth">
                              <input name="date_of_birth" type="date" className="input" required />
                            </Field>
                            <Field label="Gender">
                              <select name="gender" className="input" required>
                                <option value="">Select Gender</option>
                                <option value="F">Female</option>
                                <option value="M">Male</option>
                              </select>
                            </Field>
                            <Field label="Applying For">
                              <select
                                name="intake_form"
                                className="input font-semibold text-[#0d1f3d]"
                                value={applyIntakeForm}
                                onChange={e => setApplyIntakeForm(e.target.value)}
                                required
                              >
                                <option value="1">Form 1 (Junior Secondary)</option>
                                <option value="2">Form 2 (Junior Secondary)</option>
                                <option value="3">Form 3 (Senior Secondary / O-Level)</option>
                                <option value="4">Form 4 (Senior Secondary / O-Level)</option>
                                <option value="5">Form 5 (ZIMSEC A-Level)</option>
                                <option value="6">Form 6 (ZIMSEC A-Level)</option>
                              </select>
                            </Field>
                            <Field label="Previous School">
                              <input name="previous_school" className="input" placeholder="e.g. Norton Primary School" />
                            </Field>
                            <div className="sm:col-span-2">
                              <Field label={applyIntakeForm === "5" ? "Subjects of Interest (Form 5 A-Level)" : "Subjects of Interest"}>
                                <input
                                  name="subjects_interest"
                                  className="input disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
                                  placeholder={
                                    applyIntakeForm === "5"
                                      ? "e.g. Mathematics, Physics, Chemistry / Accounting, Economics"
                                      : "Only fillable when applying for Form 5 (A-Level)"
                                  }
                                  disabled={applyIntakeForm !== "5"}
                                  value={applyIntakeForm === "5" ? applySubjectsInterest : ""}
                                  onChange={e => setApplySubjectsInterest(e.target.value)}
                                />
                              </Field>
                            </div>
                          </div>
                        </div>

                        <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 sm:p-5 space-y-4">
                          <h3 className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-[#0d1f3d]">
                            2. Parent / Guardian Details
                          </h3>
                          <div className="grid sm:grid-cols-2 gap-3 sm:gap-4">
                            <Field label="Guardian Full Name">
                              <input name="guardian_name" className="input" placeholder="e.g. Mr. John Moyo" required />
                            </Field>
                            <Field label="Phone (+263...)">
                              <input
                                name="guardian_phone"
                                className="input"
                                placeholder="+263771234567"
                                pattern="\+263\d{9}"
                                title="Format: +263 followed by 9 digits"
                                required
                              />
                            </Field>
                            <div className="sm:col-span-2">
                              <Field label="Email Address (Optional)">
                                <input name="guardian_email" type="email" className="input" placeholder="guardian@example.com" />
                              </Field>
                            </div>
                          </div>
                        </div>

                        <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 sm:p-5 space-y-4">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                            <h3 className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-[#0d1f3d]">
                              3. Required Supporting Documents
                            </h3>
                            <span className="text-[10px] sm:text-[11px] font-bold text-[#c41e2a] uppercase tracking-wide">
                              * Both documents required
                            </span>
                          </div>
                          <div className="grid sm:grid-cols-2 gap-3 sm:gap-4">
                            <Field label="Birth Certificate (PDF or Image) *">
                              <input
                                name="birth_cert"
                                type="file"
                                accept=".pdf,.png,.jpg,.jpeg"
                                required
                                className="input file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-[11px] sm:file:text-xs file:bg-slate-100 cursor-pointer text-xs sm:text-sm"
                              />
                            </Field>
                            <Field label="Previous School Report Card *">
                              <input
                                name="last_report"
                                type="file"
                                accept=".pdf,.png,.jpg,.jpeg"
                                required
                                className="input file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-[11px] sm:file:text-xs file:bg-slate-100 cursor-pointer text-xs sm:text-sm"
                              />
                            </Field>
                          </div>
                        </div>

                        <input name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" />

                        <ErrorNote msg={applyErr} />

                        <button
                          type="submit"
                          disabled={applyBusy}
                          className="w-full rounded-lg bg-[#0d1f3d] hover:bg-[#1a3563] text-white font-extrabold text-xs sm:text-sm uppercase tracking-wider py-3 sm:py-3.5 px-4 transition disabled:opacity-50 cursor-pointer"
                        >
                          {applyBusy ? "Submitting Application..." : "Submit Enrolment Application"}
                        </button>
                      </form>
                    )}
                  </div>
                )}

                {/* ─── TAB: TRACK APPLICATION ─── */}
                {activeTab === "track" && (
                  <div className="animate-fade-in max-w-md mx-auto">
                    <div className="text-center mb-6 sm:mb-8">
                      <h2 className="text-lg sm:text-xl md:text-2xl font-black text-[#0d1f3d] tracking-tight uppercase">
                        Track Application Status
                      </h2>
                      <p className="text-[11px] sm:text-xs text-slate-500 mt-1 font-medium">
                        Enter your application reference number and phone number
                      </p>
                    </div>

                    <form onSubmit={submitTrack} className="space-y-4">
                      <div>
                        <label className="block text-[11px] sm:text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                          Reference Number
                        </label>
                        <input
                          value={trackRef}
                          onChange={e => setTrackRef(e.target.value)}
                          className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-mono text-slate-900 focus:border-[#0d1f3d] focus:outline-none focus:ring-2 focus:ring-navy-100"
                          placeholder="e.g. SE-2026-ABC123"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] sm:text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                          Guardian Phone Number
                        </label>
                        <input
                          value={trackPhone}
                          onChange={e => setTrackPhone(e.target.value)}
                          className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 focus:border-[#0d1f3d] focus:outline-none focus:ring-2 focus:ring-navy-100"
                          placeholder="+263..."
                          required
                        />
                      </div>

                      <ErrorNote msg={trackErr} />

                      <button
                        type="submit"
                        disabled={trackBusy}
                        className="w-full rounded-lg bg-[#0d1f3d] hover:bg-[#1a3563] text-white font-extrabold text-xs sm:text-sm uppercase tracking-wider py-3 px-4 transition disabled:opacity-50 cursor-pointer"
                      >
                        {trackBusy ? "Checking Status..." : "Search Application"}
                      </button>
                    </form>

                    {trackResult && (
                      <div className="mt-5 sm:mt-6 rounded-xl border border-emerald-300 bg-emerald-50/80 p-4 sm:p-5 text-sm animate-fade-in">
                        <p className="font-extrabold text-emerald-950 text-sm sm:text-base">{trackResult.name}</p>
                        <p className="text-[11px] sm:text-xs text-slate-600 mt-0.5">Applied for Form {trackResult.intake_form}</p>
                        <div className="mt-3 pt-3 border-t border-emerald-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <span className="text-[11px] sm:text-xs font-bold uppercase text-slate-600">Current Status:</span>
                          <span className="font-black uppercase text-emerald-900 bg-white px-3 py-1 rounded-md border border-emerald-300 text-xs sm:text-sm">
                            {trackResult.status.replace("_", " ")}
                          </span>
                        </div>
                      </div>
                    )}

                    <div className="mt-6 sm:mt-8 text-center text-[11px] sm:text-xs">
                      <button
                        type="button"
                        onClick={() => setActiveTab("login")}
                        className="text-[#0d1f3d] font-bold hover:underline cursor-pointer"
                      >
                        Return to Portal Login
                      </button>
                    </div>
                  </div>
                )}

                {/* ─── TAB: HELP & SUPPORT ─── */}
                {activeTab === "help" && (
                  <div className="animate-fade-in max-w-lg mx-auto space-y-5 sm:space-y-6">
                    <div className="text-center mb-4 sm:mb-6">
                      <h2 className="text-lg sm:text-xl md:text-2xl font-black text-[#0d1f3d] tracking-tight uppercase">
                        Help & Support
                      </h2>
                      <p className="text-[11px] sm:text-xs text-slate-500 mt-1">
                        Account provisioning and technical guidelines
                      </p>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 sm:p-5 space-y-3 sm:space-y-3.5 text-xs text-slate-700">
                      <div>
                        <p className="font-bold text-[#0d1f3d] text-xs sm:text-sm">1. Learner & Parent Accounts</p>
                        <p className="text-slate-600 leading-relaxed mt-0.5 text-[11px] sm:text-xs">
                          Login credentials are provided upon admission by the administration office. Your username matches the student's admission number.
                        </p>
                      </div>

                      <div className="pt-2 border-t border-slate-200">
                        <p className="font-bold text-[#0d1f3d] text-xs sm:text-sm">2. Teachers & Staff Access</p>
                        <p className="text-slate-600 leading-relaxed mt-0.5 text-[11px] sm:text-xs">
                          Staff accounts are managed by the school systems administrator. Contact administration for role permissions.
                        </p>
                      </div>

                      <div className="pt-2 border-t border-slate-200">
                        <p className="font-bold text-[#0d1f3d] text-xs sm:text-sm">3. Heads of Department (HOD)</p>
                        <p className="text-slate-600 leading-relaxed mt-0.5 text-[11px] sm:text-xs">
                          HODs log in with their study credentials (e.g. <code className="bg-white px-1 py-0.5 rounded border border-slate-300 font-bold text-[#0d1f3d] text-[10px]">hod.sciences</code>, <code className="bg-white px-1 py-0.5 rounded border border-slate-300 font-bold text-[#0d1f3d] text-[10px]">hod.commercials</code>, <code className="bg-white px-1 py-0.5 rounded border border-slate-300 font-bold text-[#0d1f3d] text-[10px]">hod.humanities</code>, <code className="bg-white px-1 py-0.5 rounded border border-slate-300 font-bold text-[#0d1f3d] text-[10px]">hod.languages</code>, <code className="bg-white px-1 py-0.5 rounded border border-slate-300 font-bold text-[#0d1f3d] text-[10px]">hod.voctech</code>) with password <code className="bg-white px-1 py-0.5 rounded border border-slate-300 font-bold text-[#c41e2a] text-[10px]">admin123</code> to assign teachers of their study to classes.
                        </p>
                      </div>

                      <div className="pt-2 border-t border-slate-200">
                        <p className="font-bold text-[#0d1f3d] text-xs sm:text-sm">4. Password Resets</p>
                        <p className="text-slate-600 leading-relaxed mt-0.5 text-[11px] sm:text-xs">
                          For student data privacy, password resets are processed in person at the administration office.
                        </p>
                      </div>
                    </div>

                    <div className="text-center pt-1 sm:pt-2">
                      <button
                        type="button"
                        onClick={() => setActiveTab("login")}
                        className="rounded-lg bg-[#0d1f3d] px-5 sm:px-6 py-2.5 text-xs font-bold text-white hover:bg-[#1a3563] cursor-pointer"
                      >
                        Return to Login
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* ═══════════════════════════════════════════════════════════
          FOOTER
         ═══════════════════════════════════════════════════════════ */}
      <footer className="border-t border-slate-200 bg-white py-3 sm:py-3.5 px-4 sm:px-8 text-[10px] sm:text-xs text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-1 sm:gap-2">
        <span className="font-semibold text-slate-600">
          St Eric High School · Online Administration Platform
        </span>
        <span className="text-[10px] sm:text-[11px] text-slate-400 text-center">
          Stand No 2395, Shonhiwa Drive, Norton, Zimbabwe · Service and Excellence
        </span>
      </footer>
    </div>
  );
}
