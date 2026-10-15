import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  Eye,
  EyeOff,
  FileSearch,
  GraduationCap,
  HelpCircle,
  Lock,
  LogIn,
  Menu,
  Phone,
  Search,
  ShieldCheck,
  User,
  UserPlus,
  X,
} from "lucide-react";
import { login, session } from "../lib/api";
import { ErrorNote, Field } from "../components/ui";

export default function Login() {
  const nav = useNavigate();
  const [activeTab, setActiveTab] = useState<"login" | "track" | "apply" | "help">("login");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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

  const quickLinks = [
    { id: "login", label: "Portal Login", icon: LogIn },
    { id: "apply", label: "New Application", icon: UserPlus },
    { id: "track", label: "Track Application", icon: FileSearch },
    { id: "help", label: "Help & Support", icon: HelpCircle },
  ];

  return (
    <div className="min-h-screen bg-[#f1f5f9] font-sans flex flex-col justify-between selection:bg-[#0d1f3d] selection:text-white">
      {/* ════════════════════════════════════════════════════════════════
          1. HEADER: UZ-STYLE SPLIT BANNER (Clean White on Left, Dynamic Navy & Gold/Crimson Geometric Shapes on Right)
         ════════════════════════════════════════════════════════════════ */}
      <header className="bg-white border-b-2 border-slate-200 relative overflow-hidden shadow-xs z-20">
        {/* Dynamic Angular Geometric Shapes on Right (UZ Emhare style: Navy Blue Wedge with Gold & Crimson Accent Bands) */}
        <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-3/5 lg:w-1/2 overflow-hidden hidden md:block z-0">
          {/* Main Deep Navy Geometric Wedge */}
          <div 
            className="absolute inset-y-0 right-0 w-full bg-[#0d1f3d]"
            style={{ clipPath: "polygon(28% 0%, 100% 0%, 100% 100%, 0% 100%)" }}
          />
          {/* First Angular Accent Ribbon: Golden Ochre */}
          <div 
            className="absolute inset-y-0 right-0 w-full bg-gradient-to-r from-[#dba83a] to-[#c48e24] opacity-95"
            style={{ clipPath: "polygon(22% 0%, 28% 0%, 0% 100%, 0% 100%)" }}
          />
          {/* Secondary Angular Accent Ribbon: St Eric Crimson */}
          <div 
            className="absolute inset-y-0 right-0 w-full bg-[#c41e2a]"
            style={{ clipPath: "polygon(17% 0%, 21% 0%, 0% 70%, 0% 50%)" }}
          />
          {/* Dynamic Floating Geometric Highlights inside the Navy Wedge */}
          <div 
            className="absolute top-0 right-1/4 w-32 h-full bg-white/5"
            style={{ clipPath: "polygon(50% 0%, 100% 0%, 50% 100%, 0% 100%)" }}
          />
          <div 
            className="absolute -bottom-6 right-16 w-48 h-24 bg-[#dba83a]/20"
            style={{ clipPath: "polygon(20% 0%, 100% 0%, 80% 100%, 0% 100%)" }}
          />
        </div>

        {/* Header Content */}
        <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-8 py-5 sm:py-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            {/* Left: Clean White area with Big St Eric Crest & School Details */}
            <div className="flex items-center gap-5 sm:gap-7">
              <div className="h-20 w-20 sm:h-24 sm:w-24 md:h-28 md:w-28 rounded-2xl bg-white p-2 border-2 border-slate-200 shadow-sm flex items-center justify-center shrink-0">
                <img
                  src="/logo-white.png"
                  alt="St Eric High School Crest"
                  className="h-full w-full object-contain"
                />
              </div>

              <div>
                <h1 className="text-2xl sm:text-3xl md:text-4xl font-black text-[#0d1f3d] tracking-tight uppercase leading-none font-display">
                  St Eric High School
                </h1>

                <div className="mt-2 flex items-center gap-2 sm:gap-3">
                  <span className="text-xs sm:text-sm font-extrabold tracking-widest text-[#c41e2a] uppercase">
                    Service and Excellence
                  </span>
                  <span className="text-slate-300">|</span>
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Norton, Zimbabwe
                  </span>
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 font-medium">
                  <span>Stand No 2395, Shonhiwa Drive, Norton</span>
                  <span className="hidden sm:inline text-slate-300">·</span>
                  <span className="flex items-center gap-1">
                    <Phone size={12} className="text-[#c41e2a]" />
                    <span>062-2087 / 062-2200</span>
                  </span>
                </div>
              </div>
            </div>

            {/* Right: ACADEMIC YEAR 2026 (Displayed on top of the Navy Geometric Wedge) */}
            <div className="hidden md:flex items-center z-10">
              <div className="flex flex-col items-end text-right pr-4 lg:pr-8">
                <span className="text-[11px] font-black uppercase tracking-[0.25em] text-[#dba83a]">
                  Academic Year
                </span>
                <span className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight text-white leading-none mt-1 font-display drop-shadow-md">
                  2026
                </span>
                <div className="h-1.5 w-20 bg-gradient-to-r from-[#dba83a] to-[#c41e2a] rounded-full mt-2" />
              </div>
            </div>

            {/* Mobile View: Year Badge and Mobile Toggle */}
            <div className="flex md:hidden items-center justify-between pt-2 border-t border-slate-100">
              <div className="flex items-baseline gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Academic Year:</span>
                <span className="text-xl font-black text-[#0d1f3d]">2026</span>
              </div>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(s => !s)}
                className="p-2 rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 cursor-pointer"
                aria-label="Toggle menu"
              >
                {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
              </button>
            </div>
          </div>
        </div>

        {/* Multi-layered Geometric Accent Border across bottom of header (Navy + Crimson + Gold) */}
        <div className="relative h-1.5 w-full flex">
          <div className="w-1/2 bg-[#0d1f3d]" />
          <div className="w-1/4 bg-[#c41e2a]" />
          <div className="w-1/4 bg-[#dba83a]" />
        </div>
      </header>

      {/* ════════════════════════════════════════════════════════════════
          2. MAIN CONTENT: QUICK NAVIGATION + GRADIENT-LINED LOGIN SQUARE
         ════════════════════════════════════════════════════════════════ */}
      <main className="flex-1 mx-auto w-full max-w-7xl px-4 sm:px-8 py-8 sm:py-12">
        <div className="grid md:grid-cols-[240px_1fr] lg:grid-cols-[260px_1fr] gap-6 lg:gap-8 items-start">
          {/* ─────────────────────────────────────────────────────────────
              LEFT COLUMN: QUICK NAVIGATION (CLEAN WHITE CARD)
             ───────────────────────────────────────────────────────────── */}
          <aside className={`${mobileMenuOpen ? "block" : "hidden"} md:block w-full`}>
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden sticky top-6">
              {/* Clean Dark Navy Header */}
              <div className="bg-[#0d1f3d] px-5 py-4">
                <h3 className="text-xs font-black uppercase tracking-wider text-white">
                  Quick Navigation
                </h3>
              </div>

              {/* Navigation Items */}
              <nav className="divide-y divide-slate-100 bg-white">
                {quickLinks.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setActiveTab(item.id as any);
                        setMobileMenuOpen(false);
                        setErr("");
                      }}
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

          {/* ─────────────────────────────────────────────────────────────
              RIGHT COLUMN: LOGIN SQUARE WITH GRADIENT-LIKE LINING & BORDER
             ───────────────────────────────────────────────────────────── */}
          <div className="w-full">
            {/* Outer gradient-lining wrapper creating the multi-colored borders */}
            <div className="rounded-2xl p-[3px] bg-gradient-to-br from-[#0d1f3d] via-[#1a3563] to-[#c41e2a] shadow-xl">
              <div className="bg-white rounded-[13px] p-6 sm:p-10 lg:p-12 relative overflow-hidden">
                {/* Subtle top-edge gradient accent bar inside the card */}
                <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#0d1f3d] via-[#1a3563] to-[#c41e2a]" />

                {/* ─────────────────────────────────────────────────────────
                    TAB 1: PORTAL LOGIN
                   ───────────────────────────────────────────────────────── */}
                {activeTab === "login" && (
                  <div className="animate-fade-in max-w-md mx-auto">
                    <div className="text-center mb-8">
                      <h2 className="text-xl sm:text-2xl font-black text-[#0d1f3d] tracking-tight uppercase">
                        Welcome to St Eric Portal
                      </h2>
                      <p className="text-xs text-slate-500 mt-1 font-medium">
                        Sign in to access your student, teacher, or guardian dashboard
                      </p>
                    </div>

                  {session.token() && (
                    <div className="mb-6 p-4 rounded-xl bg-navy-50 border border-navy-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
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
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5" htmlFor="username">
                        Username
                      </label>
                      <div className="relative">
                        <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
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
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5" htmlFor="password">
                        Password
                      </label>
                      <div className="relative">
                        <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
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
                          className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
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

                  <div className="mt-8 text-center text-xs text-slate-500 pt-4 border-t border-slate-100">
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

              {/* ─────────────────────────────────────────────────────────
                  TAB 2: NEW APPLICATION
                 ───────────────────────────────────────────────────────── */}
              {activeTab === "apply" && (
                <div className="animate-fade-in max-w-2xl mx-auto">
                  <div className="text-center mb-8">
                    <h2 className="text-xl sm:text-2xl font-black text-[#0d1f3d] tracking-tight uppercase">
                      New Student Enrolment Form
                    </h2>
                    <p className="text-xs text-slate-500 mt-1">
                      Online application for Form 1 and Form 5 (ZIMSEC A-Level)
                    </p>
                  </div>

                  {applyRef ? (
                    <div className="rounded-xl border border-emerald-300 bg-emerald-50/80 p-8 text-center animate-fade-in">
                      <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-full bg-emerald-100 text-emerald-700">
                        <CheckCircle2 size={32} />
                      </div>
                      <h3 className="text-xl font-bold text-emerald-950">Application Submitted</h3>
                      <p className="text-xs text-slate-600 mt-1">Your official reference number is:</p>
                      <p className="my-3 font-mono text-2xl font-black text-[#0d1f3d] bg-white py-2 px-5 rounded-lg border border-slate-200 inline-block shadow-2xs">
                        {applyRef}
                      </p>
                      <p className="text-xs text-slate-500 max-w-md mx-auto">
                        Please save this reference number. Use it together with your guardian phone number on the "Track Application" tab to check progress.
                      </p>
                      <div className="mt-6 flex justify-center gap-3">
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
                    <form onSubmit={submitApply} className="space-y-6">
                      <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-5 space-y-4">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-[#0d1f3d]">
                          1. Prospective Learner Information
                        </h3>
                        <div className="grid sm:grid-cols-2 gap-4">
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

                      <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-5 space-y-4">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-[#0d1f3d]">
                          2. Parent / Guardian Details
                        </h3>
                        <div className="grid sm:grid-cols-2 gap-4">
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

                      <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-5 space-y-4">
                        <div className="flex items-center justify-between">
                          <h3 className="text-xs font-bold uppercase tracking-wider text-[#0d1f3d]">
                            3. Required Supporting Documents
                          </h3>
                          <span className="text-[11px] font-bold text-[#c41e2a] uppercase tracking-wide">
                            * Both documents required
                          </span>
                        </div>
                        <div className="grid sm:grid-cols-2 gap-4">
                          <Field label="Birth Certificate (PDF or Image) *">
                            <input
                              name="birth_cert"
                              type="file"
                              accept=".pdf,.png,.jpg,.jpeg"
                              required
                              className="input file:mr-3 file:py-1 file:px-2 file:rounded file:border-0 file:text-xs file:bg-slate-100 cursor-pointer"
                            />
                          </Field>
                          <Field label="Previous School Report Card *">
                            <input
                              name="last_report"
                              type="file"
                              accept=".pdf,.png,.jpg,.jpeg"
                              required
                              className="input file:mr-3 file:py-1 file:px-2 file:rounded file:border-0 file:text-xs file:bg-slate-100 cursor-pointer"
                            />
                          </Field>
                        </div>
                      </div>

                      <input name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" />

                      <ErrorNote msg={applyErr} />

                      <button
                        type="submit"
                        disabled={applyBusy}
                        className="w-full rounded-lg bg-[#0d1f3d] hover:bg-[#1a3563] text-white font-extrabold text-sm uppercase tracking-wider py-3.5 px-4 transition disabled:opacity-50 cursor-pointer"
                      >
                        {applyBusy ? "Submitting Application..." : "Submit Enrolment Application"}
                      </button>
                    </form>
                  )}
                </div>
              )}

              {/* ─────────────────────────────────────────────────────────
                  TAB 3: TRACK APPLICATION
                 ───────────────────────────────────────────────────────── */}
              {activeTab === "track" && (
                <div className="animate-fade-in max-w-md mx-auto">
                  <div className="text-center mb-8">
                    <h2 className="text-xl sm:text-2xl font-black text-[#0d1f3d] tracking-tight uppercase">
                      Track Application Status
                    </h2>
                    <p className="text-xs text-slate-500 mt-1 font-medium">
                      Enter your application reference number and phone number
                    </p>
                  </div>

                  <form onSubmit={submitTrack} className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
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
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
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
                      className="w-full rounded-lg bg-[#0d1f3d] hover:bg-[#1a3563] text-white font-extrabold text-sm uppercase tracking-wider py-3 px-4 transition disabled:opacity-50 cursor-pointer"
                    >
                      {trackBusy ? "Checking Status..." : "Search Application"}
                    </button>
                  </form>

                  {trackResult && (
                    <div className="mt-6 rounded-xl border border-emerald-300 bg-emerald-50/80 p-5 text-sm animate-fade-in">
                      <p className="font-extrabold text-emerald-950 text-base">{trackResult.name}</p>
                      <p className="text-xs text-slate-600 mt-0.5">Applied for Form {trackResult.intake_form}</p>
                      <div className="mt-3 pt-3 border-t border-emerald-200 flex items-center justify-between">
                        <span className="text-xs font-bold uppercase text-slate-600">Current Status:</span>
                        <span className="font-black uppercase text-emerald-900 bg-white px-3 py-1 rounded-md border border-emerald-300">
                          {trackResult.status.replace("_", " ")}
                        </span>
                      </div>
                    </div>
                  )}

                  <div className="mt-8 text-center text-xs">
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

              {/* ─────────────────────────────────────────────────────────
                  TAB 4: HELP & SUPPORT
                 ───────────────────────────────────────────────────────── */}
              {activeTab === "help" && (
                <div className="animate-fade-in max-w-lg mx-auto space-y-6">
                  <div className="text-center mb-6">
                    <h2 className="text-xl sm:text-2xl font-black text-[#0d1f3d] tracking-tight uppercase">
                      Help & Support
                    </h2>
                    <p className="text-xs text-slate-500 mt-1">
                      Account provisioning and technical guidelines
                    </p>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 space-y-3.5 text-xs text-slate-700">
                    <div>
                      <p className="font-bold text-[#0d1f3d] text-sm">1. Learner & Parent Accounts</p>
                      <p className="text-slate-600 leading-relaxed mt-0.5">
                        Login credentials are provided upon admission by the administration office. Your username matches the student's admission number.
                      </p>
                    </div>

                    <div className="pt-2 border-t border-slate-200">
                      <p className="font-bold text-[#0d1f3d] text-sm">2. Teachers & Staff Access</p>
                      <p className="text-slate-600 leading-relaxed mt-0.5">
                        Staff accounts are managed by the school systems administrator. Contact administration for role permissions.
                      </p>
                    </div>

                    <div className="pt-2 border-t border-slate-200">
                      <p className="font-bold text-[#0d1f3d] text-sm">3. Heads of Department (HOD)</p>
                      <p className="text-slate-600 leading-relaxed mt-0.5">
                        HODs log in with their study credentials (e.g. <code className="bg-white px-1.5 py-0.5 rounded border border-slate-300 font-bold text-[#0d1f3d]">hod.sciences</code>, <code className="bg-white px-1.5 py-0.5 rounded border border-slate-300 font-bold text-[#0d1f3d]">hod.commercials</code>, <code className="bg-white px-1.5 py-0.5 rounded border border-slate-300 font-bold text-[#0d1f3d]">hod.humanities</code>, <code className="bg-white px-1.5 py-0.5 rounded border border-slate-300 font-bold text-[#0d1f3d]">hod.languages</code>, <code className="bg-white px-1.5 py-0.5 rounded border border-slate-300 font-bold text-[#0d1f3d]">hod.voctech</code>) with password <code className="bg-white px-1.5 py-0.5 rounded border border-slate-300 font-bold text-[#c41e2a]">admin123</code> to assign teachers of their study to classes.
                      </p>
                    </div>

                    <div className="pt-2 border-t border-slate-200">
                      <p className="font-bold text-[#0d1f3d] text-sm">4. Password Resets</p>
                      <p className="text-slate-600 leading-relaxed mt-0.5">
                        For student data privacy, password resets are processed in person at the administration office.
                      </p>
                    </div>
                  </div>

                  <div className="text-center pt-2">
                    <button
                      type="button"
                      onClick={() => setActiveTab("login")}
                      className="rounded-lg bg-[#0d1f3d] px-6 py-2.5 text-xs font-bold text-white hover:bg-[#1a3563] cursor-pointer"
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

      {/* ════════════════════════════════════════════════════════════════
          3. CLEAN INSTITUTIONAL FOOTER
         ════════════════════════════════════════════════════════════════ */}
      <footer className="border-t border-slate-200 bg-white py-3.5 px-4 sm:px-8 text-xs text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-2">
        <span className="font-semibold text-slate-600">
          St Eric High School · Online Administration Platform
        </span>
        <span className="text-[11px] text-slate-400">
          Stand No 2395, Shonhiwa Drive, Norton, Zimbabwe · Service and Excellence
        </span>
      </footer>
    </div>
  );
}
