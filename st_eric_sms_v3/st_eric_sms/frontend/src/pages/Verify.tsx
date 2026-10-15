import { useParams } from "react-router-dom";
import { CheckCircle2, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { Logo, Spinner } from "../components/ui";

export default function Verify() {
  const { sid, term, year, sig } = useParams(); const [r, setR] = useState<any>(null);
  useEffect(() => { fetch(`/api/v1/verify/${sid}/${term}/${year}/${sig}`).then(x => x.json()).then(setR).catch(() => setR({ genuine: false, offline: true })); }, [sid, term, year, sig]);
  return (
    <div className="grid min-h-screen place-items-center p-6"><div className="card w-full max-w-md p-8 text-center"><div className="mb-5 flex justify-center"><Logo size={56} /></div>
      {!r ? <Spinner /> : r.genuine ? (<><CheckCircle2 className="mx-auto text-emerald-600" size={48} /><h1 className="mt-3 font-display text-2xl text-navy-800">Genuine report</h1>
        <p className="mt-4 text-lg font-medium">{r.student}</p><p className="text-sm text-mute">{r.class} · Term {r.term} {r.year}</p><p className="mt-3 text-sm">Overall average: <b>{r.overall}%</b></p>
        <p className="mt-5 text-xs text-mute">Check that these details match the printed report.</p></>) : (<><XCircle className="mx-auto text-red-600" size={48} /><h1 className="mt-3 font-display text-2xl text-navy-800">{r.offline ? "Could not check" : "Not verified"}</h1>
        <p className="mt-2 text-sm text-mute">{r.offline ? "Check your internet connection and scan again." : "This code does not match a report issued by St Eric High School. Do not accept this document."}</p></>)}
    </div></div>
  );
}
