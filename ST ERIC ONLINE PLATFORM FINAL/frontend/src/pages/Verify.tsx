import { useParams } from "react-router-dom";
import { CheckCircle2, ShieldCheck, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { Spinner } from "../components/ui";

export default function Verify() {
  const { sid, term, year, sig } = useParams();
  const [r, setR] = useState<any>(null);

  useEffect(() => {
    fetch(`/api/v1/verify/${sid}/${term}/${year}/${sig}`)
      .then(x => x.json())
      .then(setR)
      .catch(() => setR({ genuine: false, offline: true }));
  }, [sid, term, year, sig]);

  return (
    <div className="min-h-screen bg-[#f1f5f9] flex flex-col justify-between selection:bg-[#0d1f3d] selection:text-white">
      {/* Header */}
      <header className="bg-white border-b-2 border-slate-200 relative overflow-hidden shadow-xs">
        <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-1/3 overflow-hidden hidden sm:block">
          <div className="absolute -top-12 -right-12 h-56 w-56 rounded-full border-[14px] border-[#0d1f3d]/10" />
          <div className="absolute top-2 right-12 h-36 w-36 rounded-full bg-gradient-to-br from-[#c41e2a]/15 to-[#dba83a]/20 blur-sm" />
        </div>

        <div className="mx-auto max-w-4xl px-4 sm:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-xl bg-white p-1.5 border border-slate-200 shadow-xs flex items-center justify-center">
              <img src="/logo-white.png" alt="St Eric High School" className="h-full w-full object-contain" />
            </div>
            <div>
              <h1 className="text-xl font-black text-[#0d1f3d] tracking-tight uppercase leading-none font-display">
                St Eric High School
              </h1>
              <p className="text-xs font-bold text-[#c41e2a] uppercase tracking-wider mt-1">
                Document Verification Portal
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1 text-xs font-bold text-slate-500 uppercase tracking-wider">
            <ShieldCheck size={16} className="text-[#0d1f3d]" />
            <span>Digital QR Verification</span>
          </div>
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
          <div className="bg-white rounded-2xl border-2 border-[#0d1f3d] shadow-md p-8 text-center ring-4 ring-navy-100/40 animate-fade-in">
            {!r ? (
              <div className="py-8">
                <Spinner />
                <p className="text-xs text-slate-500 mt-2 font-medium">Validating digital cryptographic signature…</p>
              </div>
            ) : r.genuine ? (
              <div className="space-y-4">
                <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-emerald-100 text-emerald-700">
                  <CheckCircle2 size={36} />
                </div>
                <div>
                  <span className="inline-block px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-300">
                    Official Authenticated Report
                  </span>
                  <h2 className="mt-3 text-2xl font-black text-[#0d1f3d] tracking-tight">
                    {r.student}
                  </h2>
                  <p className="text-sm font-semibold text-slate-600 mt-0.5">
                    {r.class} · Term {r.term}, {r.year}
                  </p>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm space-y-2">
                  <div className="flex justify-between">
                    <span className="text-xs text-slate-500 font-bold uppercase">Overall Average:</span>
                    <span className="font-extrabold text-[#0d1f3d] text-base">{r.overall}%</span>
                  </div>
                  <div className="flex justify-between border-t border-slate-200 pt-2 text-xs">
                    <span className="text-slate-500">Issued by:</span>
                    <span className="font-semibold text-slate-700">St Eric High School</span>
                  </div>
                </div>

                <p className="text-xs text-slate-500 leading-relaxed">
                  This report has been digitally signed and confirmed authentic against St Eric High School examination records.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-red-100 text-red-700">
                  <XCircle size={36} />
                </div>
                <div>
                  <span className="inline-block px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider bg-red-100 text-red-800 border border-red-300">
                    {r.offline ? "Verification Unavailable" : "Invalid Document"}
                  </span>
                  <h2 className="mt-3 text-xl font-black text-red-950">
                    {r.offline ? "Could Not Connect" : "Report Not Verified"}
                  </h2>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  {r.offline
                    ? "Check your internet connection and scan the QR code again."
                    : "This QR code does not match any official academic report issued by St Eric High School. Do not accept an unverified copy."}
                </p>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-3 px-4 text-center text-xs text-slate-500">
        St Eric High School · Online Administration Platform · Norton, Zimbabwe
      </footer>
    </div>
  );
}
