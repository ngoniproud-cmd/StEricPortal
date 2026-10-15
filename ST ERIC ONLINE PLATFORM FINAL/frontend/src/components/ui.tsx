import { ReactNode, useEffect, useState } from "react";
import { AlertCircle, Loader2 } from "lucide-react";

export function Logo({ size = 40 }: { size?: number }) {
  const [bad, setBad] = useState(false);
  return bad ? (
    <div style={{ width: size, height: size }} className="grid shrink-0 place-items-center rounded-xl bg-navy-800 font-display font-bold text-white text-xs">SE</div>
  ) : (
    <div className="inline-flex items-center justify-center p-1 rounded-xl bg-white shadow-xs border border-slate-200/90 shrink-0">
      <img src="/logo-white.png" alt="St Eric High School" onError={() => setBad(true)} style={{ height: size }} className="w-auto shrink-0 object-contain" />
    </div>
  );
}

export const PageHeader = ({ eyebrow, title, sub, children }: { eyebrow?: string; title: string; sub?: string; children?: ReactNode }) => (
  <div className="mb-6 sm:mb-8 page-enter">
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div>
        {eyebrow && <p className="mb-1 text-[11px] sm:text-xs font-bold uppercase tracking-wider text-[#c41e2a]">{eyebrow}</p>}
        <h1 className="text-xl sm:text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">{title}</h1>
        {sub && <p className="mt-1 text-xs sm:text-sm text-slate-500 font-medium">{sub}</p>}
      </div>
      <div className="flex flex-wrap items-center gap-2.5">{children}</div>
    </div>
  </div>
);

export const Spinner = () => <div className="flex justify-center p-12 text-navy-600"><Loader2 className="animate-spin" size={28} /></div>;

export const Skeleton = ({ className = "h-4 w-full" }: { className?: string }) => (
  <div className={`animate-pulse rounded-lg bg-slate-100 ${className}`} />
);

export const TableSkeleton = ({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) => (
  <div className="card-static divide-y divide-slate-100 p-6 space-y-3">
    {Array.from({ length: rows }).map((_, i) => (
      <div key={i} className="flex gap-4 py-2">
        {Array.from({ length: cols }).map((_, j) => (
          <Skeleton key={j} className={`h-4 ${j === 0 ? "w-1/3" : "w-1/6"}`} />
        ))}
      </div>
    ))}
  </div>
);

export const ErrorNote = ({ msg }: { msg: string }) => msg ? (
  <div role="alert" className="flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
    <AlertCircle size={16} className="mt-0.5 shrink-0 text-rose-600" />
    <span className="font-medium">{msg}</span>
  </div>
) : null;

export const Empty = ({ title, hint }: { title: string; hint?: string }) => (
  <div className="card-static grid place-items-center px-8 py-16 text-center">
    <div className="mb-3 h-1.5 w-10 rounded-full bg-slate-200" />
    <p className="text-base font-bold text-slate-800">{title}</p>
    {hint && <p className="mt-1 max-w-sm text-xs text-slate-500 leading-relaxed">{hint}</p>}
  </div>
);

export const Field = ({ label, children }: { label: string; children: ReactNode }) => (
  <label className="block">
    <span className="label">{label}</span>
    {children}
  </label>
);

export function Select({ value, onChange, children, ...rest }: { value: any; onChange: (v: string) => void; children: ReactNode } & Record<string, any>) {
  return <select {...rest} className="input" value={value ?? ""} onChange={e => onChange(e.target.value)}>{children}</select>;
}

export const Badge = ({ tone = "navy", children }: { tone?: "navy" | "green" | "amber" | "red" | "gold" | "crimson"; children: ReactNode }) => {
  const t: Record<string, string> = {
    navy: "bg-slate-100 text-slate-700 border border-slate-200/80",
    green: "bg-emerald-50 text-emerald-700 border border-emerald-200/80 font-semibold",
    amber: "bg-amber-50 text-amber-800 border border-amber-200/80 font-semibold",
    red: "bg-rose-50 text-rose-700 border border-rose-200/80 font-semibold",
    gold: "bg-amber-50 text-amber-800 border border-amber-200/80 font-semibold",
    crimson: "bg-rose-50 text-[#c41e2a] border border-rose-200/80 font-bold",
  };
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs ${t[tone] ?? t.navy}`}>{children}</span>;
};

export const Stat = ({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) => (
  <div className="card p-5">
    <p className="text-xs font-bold uppercase tracking-wider text-slate-400">{label}</p>
    <p className="mt-2 text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">{value}</p>
    {hint && <span className="mt-2 inline-block rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">{hint}</span>}
  </div>
);

export function Toast({ msg, onDone }: { msg: string; onDone: () => void }) {
  useEffect(() => { const t = setTimeout(onDone, 3500); return () => clearTimeout(t); }, [onDone]);
  return (
    <div role="status" className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white shadow-xl animate-fade-in">
      {msg}
    </div>
  );
}

export function useToast() {
  const [msg, setMsg] = useState("");
  return { show: setMsg, node: msg ? <Toast msg={msg} onDone={() => setMsg("")} /> : null };
}

export const gradeTone = (g?: string | null) => {
  if (!g) return "text-mute";
  const upper = g.trim().toUpperCase();
  if (upper === "A") return "text-emerald-700 font-bold";
  if (upper === "B" || upper === "C") return "text-[#0d1f3d] font-bold";
  if (upper === "D" || upper === "E") return "text-blue-700 font-semibold";
  if (upper === "O") return "text-amber-700 font-semibold";
  if (upper === "U" || upper === "F") return "text-[#c41e2a] font-bold";
  return "text-slate-800";
};
