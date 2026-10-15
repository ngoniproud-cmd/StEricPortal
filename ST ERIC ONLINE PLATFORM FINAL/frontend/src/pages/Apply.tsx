import { FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, CheckCircle2, FileText, UserPlus } from "lucide-react";
import { ErrorNote, Field } from "../components/ui";

const LINKS = [
  { label: "Portal Login", href: "/login" },
  { label: "New Application", href: "/apply", active: true },
  { label: "Track Application", href: "#track" },
  { label: "Registration Help", href: "/login" },
];

export default function Apply() {
  const [ref, setRef] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [st, setSt] = useState<any>(null);
  const [stErr, setStErr] = useState("");
  const [sideOpen, setSideOpen] = useState(false);
  const [intakeForm, setIntakeForm] = useState("1");
  const [subjectsInterest, setSubjectsInterest] = useState("");

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    const fd = new FormData(e.currentTarget);
    const bc = fd.get("birth_cert") as File;
    const lr = fd.get("last_report") as File;
    if (!bc || !bc.size) {
      setErr("Please upload the prospective learner's birth certificate (PDF or Image).");
      setBusy(false);
      return;
    }
    if (!lr || !lr.size) {
      setErr("Please upload the previous school report card or documentation (PDF or Image).");
      setBusy(false);
      return;
    }
    try {
      const r = await fetch("/api/v1/public/applications", { method: "POST", body: fd });
      const b = await r.json();
      if (!r.ok) {
        throw new Error(typeof b.detail === "string" ? b.detail : (b.detail ?? []).map((x: any) => x.msg).join(". "));
      }
      setRef(b.reference);
    } catch (x) {
      setErr((x as Error).message || "Could not submit application. Please verify details.");
    } finally {
      setBusy(false);
    }
  }

  async function check(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStErr("");
    setSt(null);
    const f = new FormData(e.currentTarget);
    const r = await fetch(`/api/v1/public/applications/status?reference=${encodeURIComponent(String(f.get("r")))}&phone=${encodeURIComponent(String(f.get("p")))}`);
    const b = await r.json();
    if (r.ok) {
      setSt(b);
    } else {
      setStErr(typeof b.detail === "string" ? b.detail : "Could not locate application record.");
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#f0f2f5] font-sans">
      {/* ════════════════════════════════════════════════════════════════
          TOP HEADER BANNER (Matching Login)
         ════════════════════════════════════════════════════════════════ */}
      <header className="relative overflow-hidden bg-[#0b1a3b]">
        <div className="pointer-events-none absolute inset-0">
          <svg className="absolute right-0 top-0 h-full w-2/3" viewBox="0 0 800 200" preserveAspectRatio="none" fill="none">
            <polygon points="300,0 800,0 800,200 500,200" fill="#122a52" />
            <polygon points="500,0 800,0 800,140" fill="#1a3563" />
            <polygon points="650,0 800,0 800,80" fill="#234b7a" />
          </svg>
          <svg className="absolute left-0 bottom-0 w-full h-3" viewBox="0 0 1200 12" preserveAspectRatio="none">
            <rect x="0" y="0" width="1200" height="4" fill="#c41e2a" />
            <rect x="0" y="5" width="1200" height="3" fill="#1a3563" />
            <rect x="0" y="9" width="1200" height="3" fill="#dba83a" />
          </svg>
        </div>

        <div className="relative z-10 mx-auto flex max-w-7xl items-center justify-between gap-5 px-4 sm:px-8 py-5 sm:py-6">
          <div className="flex items-center gap-4">
            <div className="shrink-0 rounded-xl bg-white p-2 shadow-lg border border-white/80">
              <img
                src="/logo-white.png"
                alt="St Eric High School"
                className="h-12 sm:h-14 md:h-16 w-auto object-contain"
              />
            </div>
            <div className="min-w-0">
              <h1 className="text-base sm:text-xl font-extrabold text-white tracking-tight uppercase leading-tight">
                St Eric High School
              </h1>
              <p className="text-xs font-semibold text-slate-300 uppercase tracking-wide">
                Admissions & Enrolment Portal
              </p>
            </div>
          </div>

          <Link
            to="/login"
            className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white px-3.5 py-2 text-xs font-bold transition border border-white/20"
          >
            <ArrowLeft size={14} /> Back to Login
          </Link>
        </div>
      </header>

      {/* ════════════════════════════════════════════════════════════════
          MAIN BODY: Quick Links + Application Form
         ════════════════════════════════════════════════════════════════ */}
      <main className="flex-1 mx-auto flex w-full max-w-7xl px-4 sm:px-8 py-6 sm:py-8 gap-6">
        {/* Quick Links Sidebar */}
        <aside className="hidden lg:block w-52 shrink-0">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden sticky top-6">
            <div className="bg-[#0b1a3b] px-4 py-3">
              <p className="text-xs font-extrabold uppercase tracking-wider text-white">
                Quick Links
              </p>
            </div>
            <nav className="divide-y divide-slate-100">
              {LINKS.map((lk) =>
                lk.href.startsWith("/") ? (
                  <Link
                    key={lk.label}
                    to={lk.href}
                    className={`block px-4 py-3 text-sm font-semibold transition hover:bg-navy-50 ${
                      lk.active
                        ? "text-navy-900 bg-navy-50/50 border-l-[3px] border-crimson-600"
                        : "text-navy-700 border-l-[3px] border-transparent"
                    }`}
                  >
                    {lk.label}
                  </Link>
                ) : (
                  <a
                    key={lk.label}
                    href={lk.href}
                    className={`block px-4 py-3 text-sm font-semibold transition hover:bg-navy-50 ${
                      lk.active
                        ? "text-navy-900 bg-navy-50/50 border-l-[3px] border-crimson-600"
                        : "text-navy-700 border-l-[3px] border-transparent"
                    }`}
                  >
                    {lk.label}
                  </a>
                )
              )}
            </nav>
          </div>
        </aside>

        {/* Application Form Container */}
        <div className="flex-1 max-w-3xl space-y-6">
          {ref ? (
            <div className="bg-white rounded-xl border-2 border-[#0b1a3b] p-8 text-center shadow-sm">
              <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-full bg-emerald-100 text-emerald-700">
                <CheckCircle2 size={36} />
              </div>
              <h2 className="text-2xl font-extrabold text-[#0b1a3b]">Application Submitted Successfully</h2>
              <p className="mt-2 text-sm text-slate-600">Your official application reference number is</p>
              <p className="my-4 select-all rounded-lg bg-slate-100 py-3.5 font-mono text-2xl font-extrabold text-[#0b1a3b] border border-slate-300">
                {ref}
              </p>
              <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
                Please keep this reference code safe. Use it with your registered guardian phone number to track your application status.
              </p>
              <div className="mt-6 flex justify-center gap-3">
                <button
                  type="button"
                  onClick={() => setRef("")}
                  className="rounded-lg border border-slate-300 px-5 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
                >
                  Submit Another Application
                </button>
                <Link
                  to="/login"
                  className="rounded-lg bg-[#0b1a3b] px-5 py-2.5 text-xs font-bold text-white hover:bg-[#071228] transition"
                >
                  Return to Login
                </Link>
              </div>
            </div>
          ) : (
            <form onSubmit={submit} className="bg-white rounded-xl border-2 border-[#0b1a3b] shadow-sm overflow-hidden">
              <div className="border-b border-slate-200 bg-[#0b1a3b] px-6 py-4 text-white">
                <h2 className="font-extrabold text-base uppercase tracking-wide">
                  New Student Admission Form (Forms 1 to 6)
                </h2>
                <p className="text-xs text-slate-300 mt-0.5">Please provide accurate learner and guardian details</p>
              </div>

              {/* Section 1: Learner */}
              <div className="p-6 border-b border-slate-200 bg-slate-50/40">
                <h3 className="font-bold text-sm text-[#0b1a3b] mb-4 uppercase tracking-wider">
                  1. Learner Details
                </h3>
                <div className="grid gap-4 sm:grid-cols-2">
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
                      className="input font-semibold text-[#0b1a3b]"
                      value={intakeForm}
                      onChange={e => setIntakeForm(e.target.value)}
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
                    <Field label={intakeForm === "5" ? "Subjects of Interest (Form 5 A-Level)" : "Subjects of Interest"}>
                      <input
                        name="subjects_interest"
                        className="input disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
                        placeholder={
                          intakeForm === "5"
                            ? "e.g. Mathematics, Physics, Chemistry / Accounting, Economics"
                            : "Only fillable when applying for Form 5 (A-Level)"
                        }
                        disabled={intakeForm !== "5"}
                        value={intakeForm === "5" ? subjectsInterest : ""}
                        onChange={e => setSubjectsInterest(e.target.value)}
                      />
                    </Field>
                  </div>
                </div>
              </div>

              {/* Section 2: Guardian */}
              <div className="p-6 border-b border-slate-200">
                <h3 className="font-bold text-sm text-[#0b1a3b] mb-4 uppercase tracking-wider">
                  2. Parent / Guardian Contact
                </h3>
                <div className="grid gap-4 sm:grid-cols-2">
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

              {/* Section 3: Documents */}
              <div className="p-6 border-b border-slate-200 bg-slate-50/40">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-sm text-[#0b1a3b] uppercase tracking-wider">
                    3. Required Supporting Documents
                  </h3>
                  <span className="text-[11px] font-bold text-[#c41e2a] uppercase tracking-wide">
                    * Both documents required
                  </span>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
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

              <div className="p-6 space-y-4 bg-white">
                <ErrorNote msg={err} />
                <button
                  type="submit"
                  disabled={busy}
                  className="rounded-lg bg-[#0b1a3b] hover:bg-[#071228] text-white font-extrabold text-sm uppercase tracking-wider py-3.5 px-8 transition disabled:opacity-50 cursor-pointer"
                >
                  {busy ? "Submitting Application..." : "Submit Application"}
                </button>
              </div>
            </form>
          )}

          {/* Track Application */}
          <div id="track" className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
            <h3 className="font-bold text-sm text-[#0b1a3b] uppercase tracking-wider mb-1">
              Track Application Progress
            </h3>
            <p className="text-xs text-slate-500 mb-4">Enter your tracking reference number and registered guardian phone number.</p>
            <form onSubmit={check} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
              <Field label="Reference Number">
                <input name="r" className="input" placeholder="e.g. SE-2026-ABC123" required />
              </Field>
              <Field label="Guardian Phone">
                <input name="p" className="input" placeholder="+263..." required />
              </Field>
              <button className="rounded-lg bg-[#0b1a3b] hover:bg-[#071228] text-white font-bold text-xs uppercase py-2.5 px-6 transition h-[42px] cursor-pointer">
                Track
              </button>
            </form>

            {st && (
              <div className="mt-4 rounded-lg border border-navy-200 bg-navy-50 p-4 text-xs">
                <p className="font-bold text-navy-950">{st.name} (Form {st.intake_form})</p>
                <p className="mt-1 text-slate-700">
                  Status: <span className="font-bold uppercase text-navy-900">{st.status.replace("_", " ")}</span>
                </p>
              </div>
            )}
            <ErrorNote msg={stErr} />
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-3 px-4 text-center text-[11px] text-slate-500">
        St Eric High School · Norton, Zimbabwe · Service and Excellence
      </footer>
    </div>
  );
}
