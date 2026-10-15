import { ReactNode, useEffect, useState } from "react";
import { AlertCircle, Loader2 } from "lucide-react";

export function Logo({ size = 40 }: { size?: number }) {
  const [bad, setBad] = useState(false);
  return bad ? (
    <div style={{ width: size, height: size }} className="grid shrink-0 place-items-center rounded-lg bg-gold-500 font-display font-bold text-navy-900">SE</div>
  ) : (<img src="/logo.png" alt="St Eric High School" onError={() => setBad(true)} style={{ height: size }} className="w-auto shrink-0 object-contain" />);
}
export const PageHeader = ({ eyebrow, title, sub, children }: { eyebrow?: string; title: string; sub?: string; children?: ReactNode }) => (
  <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
    <div>{eyebrow && <p className="label !mb-1 text-gold-600">{eyebrow}</p>}<h1 className="font-display text-2xl text-navy-800 md:text-3xl">{title}</h1>{sub && <p className="mt-1 text-sm text-mute">{sub}</p>}</div>
    <div className="flex flex-wrap items-center gap-2">{children}</div>
  </div>
);
export const Spinner = () => <div className="flex justify-center p-10 text-navy-500"><Loader2 className="animate-spin" /></div>;
export const ErrorNote = ({ msg }: { msg: string }) => msg ? <p role="alert" className="flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700"><AlertCircle size={16} className="mt-0.5 shrink-0" />{msg}</p> : null;
export const Empty = ({ title, hint }: { title: string; hint?: string }) => (
  <div className="card grid place-items-center px-6 py-14 text-center"><div className="mb-3 h-1 w-10 rounded bg-gold-500" /><p className="font-display text-lg text-navy-800">{title}</p>{hint && <p className="mt-1 max-w-sm text-sm text-mute">{hint}</p>}</div>
);
export const Field = ({ label, children }: { label: string; children: ReactNode }) => <label className="block"><span className="label">{label}</span>{children}</label>;
export function Select({ value, onChange, children, ...rest }: { value: any; onChange: (v: string) => void; children: ReactNode } & Record<string, any>) {
  return <select {...rest} className="input" value={value ?? ""} onChange={e => onChange(e.target.value)}>{children}</select>;
}
export const Badge = ({ tone = "navy", children }: { tone?: "navy" | "green" | "amber" | "red" | "gold"; children: ReactNode }) => {
  const t = { navy: "bg-navy-50 text-navy-700", green: "bg-emerald-50 text-emerald-700", amber: "bg-amber-50 text-amber-700", red: "bg-red-50 text-red-700", gold: "bg-gold-100 text-gold-600" }[tone];
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${t}`}>{children}</span>;
};
export const Stat = ({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) => (
  <div className="card p-5"><p className="label !mb-2">{label}</p><p className="font-display text-3xl text-navy-800">{value}</p>{hint && <p className="mt-1 text-xs text-mute">{hint}</p>}</div>
);
export function Toast({ msg, onDone }: { msg: string; onDone: () => void }) {
  useEffect(() => { const t = setTimeout(onDone, 3500); return () => clearTimeout(t); }, [onDone]);
  return <div role="status" className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-full bg-navy-900 px-5 py-2.5 text-sm text-white shadow-lg">{msg}</div>;
}
export function useToast() {
  const [msg, setMsg] = useState("");
  return { show: setMsg, node: msg ? <Toast msg={msg} onDone={() => setMsg("")} /> : null };
}
export const gradeTone = (g?: string | null) => (!g ? "text-mute" : g === "U" ? "text-red-600" : g === "A" ? "text-emerald-700" : "text-navy-800");
