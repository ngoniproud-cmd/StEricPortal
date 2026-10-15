import { useState } from "react";
import { AlertCircle, CheckCircle2, Clock, Download, FileSpreadsheet, FileText, Printer, RefreshCw, Shield, TrendingDown, TrendingUp, Upload, Wallet } from "lucide-react";
import { api, session, upload } from "../lib/api";
import { useFetch } from "../lib/hooks";
import { Badge, Empty, ErrorNote, PageHeader, Spinner, useToast } from "../components/ui";

const money = (n: number, c: string = "USD") =>
  `${c === "USD" ? "US$" : "ZWG$"} ${Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const formatDate = (iso: string | null | undefined) => {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return iso;
  }
};

const ago = (iso: string | null) => {
  if (!iso) return "";
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  return m < 1 ? "just now" : m < 60 ? `${m} minutes ago` : m < 1440 ? `${Math.round(m / 60)} hours ago` : `${Math.round(m / 1440)} days ago`;
};

export default function Fees() {
  const admin = session.role() === "admin";
  const q = useFetch(admin ? null : "/fees/mine");
  const toast = useToast();
  const [res, setRes] = useState<any>(null);
  const [syncing, setSyncing] = useState(false);
  const [activeTab, setActiveTab] = useState<"ledger" | "items">("ledger");

  const show = (r: any) => {
    setRes(r);
    toast.show(`${r.created} records created, ${r.updated} updated${r.errors?.length ? `, ${r.errors.length} skipped` : ""}.`);
  };

  async function handleSync() {
    setSyncing(true);
    try {
      const r = await api("/fees/sync", { method: "POST" });
      show(r);
    } catch (e) {
      toast.show((e as Error).message);
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl page-enter pb-16">
      <PageHeader
        eyebrow="Finance & Bursar"
        title="Student Fees & Account Statement"
        sub="Official student accounting ledger with itemised debits (charges), credits (payments received), date paid, and running balance."
      >
        <div className="flex flex-wrap items-center gap-2 print:hidden">
          <button
            onClick={() => window.print()}
            className="btn-outline !py-2 text-xs flex items-center gap-1.5"
          >
            <Printer size={14} /> Print Statement
          </button>
          {admin && (
            <>
              <button className="btn-outline !py-2 text-xs" onClick={handleSync} disabled={syncing}>
                <RefreshCw size={14} className={syncing ? "animate-spin" : ""} /> {syncing ? "Syncing..." : "Sync Fee DB"}
              </button>
              <label className="btn-primary !py-2 text-xs cursor-pointer">
                <Upload size={14} /> Import Fee CSV
                <input
                  hidden
                  type="file"
                  accept=".csv"
                  onChange={e => {
                    const f = e.target.files?.[0];
                    if (f) {
                      const fd = new FormData();
                      fd.append("file", f);
                      upload("/fees/import", fd)
                        .then(show)
                        .catch(x => toast.show(x.message));
                      e.target.value = "";
                    }
                  }}
                />
              </label>
            </>
          )}
        </div>
      </PageHeader>

      {/* Official Notice Banner */}
      <div className="mb-6 flex items-start gap-3 rounded-xl border border-navy-200 bg-gradient-to-r from-navy-50 to-white p-4 print:hidden">
        <Shield size={20} className="mt-0.5 shrink-0 text-navy-700" />
        <div className="text-xs leading-relaxed text-navy-900">
          <p className="font-semibold">Official St Eric High School Fee Policy & Bank Details</p>
          <p className="text-mute mt-0.5">
            This statement reflects verified bursar ledger entries. Tuition and school levies must be settled into the school account:
            <b className="text-navy-900"> CBZ Bank, Norton Branch, Account # 01224859230010</b> (Currency: USD / ZWG at official interbank rate). Always quote the learner's Admission Number as deposit reference.
          </p>
        </div>
      </div>

      {admin ? (
        <div className="card-static p-6 space-y-4">
          <div className="border-b border-line pb-3">
            <h3 className="font-display text-lg font-bold text-navy-900">Fee Data Synchronization</h3>
            <p className="text-xs text-mute">Upload a CSV file exported from Pastel / Sage or click Sync to connect to the external accounting database.</p>
          </div>

          <div className="rounded-lg bg-navy-50/50 p-4">
            <p className="text-xs font-semibold text-navy-800 uppercase tracking-wide">Required CSV Format</p>
            <code className="mt-2 block select-all font-mono text-xs text-navy-900 bg-white p-3 rounded border border-line">
              external_student_id, external_fee_id, fee_type, currency, amount_due, amount_paid
            </code>
            <p className="mt-2 text-[11px] text-mute">
              Note: <code>external_student_id</code> must match the learner's official admission number (e.g. <code>SE-2024-0009</code>). Re-importing updates previously recorded lines.
            </p>
          </div>

          {res && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-xs text-emerald-900">
              <p className="font-semibold">Sync Completed:</p>
              <p className="mt-1">
                {res.created} new records added, {res.updated} records updated.
              </p>
              {res.errors?.length > 0 && (
                <div className="mt-3 border-t border-emerald-200 pt-2 text-red-700">
                  <p className="font-semibold">Skipped Rows:</p>
                  {res.errors.slice(0, 5).map((e: any) => (
                    <p key={e.row}>Row {e.row}: {e.error}</p>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      ) : q.loading ? (
        <Spinner />
      ) : q.error ? (
        <ErrorNote msg={q.error} />
      ) : !q.data?.length ? (
        <Empty title="No Fee Accounts Linked" hint="Please ensure your account is linked to your learner at the school office." />
      ) : (
        <div className="space-y-10">
          {q.data.map((s: any) => {
            const hasDue = Object.values(s.balance || {}).some((v: any) => v > 0);
            const netBalance = Object.values(s.balance || {}).reduce((acc: number, cur: any) => acc + Number(cur || 0), 0);
            const totalBilled = s.total_billed ?? (s.records || []).reduce((acc: number, r: any) => acc + (r.due || 0), 0);
            const totalPaid = s.total_paid ?? (s.records || []).reduce((acc: number, r: any) => acc + (r.paid || 0), 0);
            const ledger = s.ledger || [];

            return (
              <div key={s.student.id} className="card-static overflow-hidden border border-line shadow-elevated">
                {/* Account Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-line bg-gradient-to-r from-navy-950 via-navy-900 to-navy-800 p-4 sm:p-6 text-white">
                  <div>
                    <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-widest text-crimson-400">
                      Bursar Student Account Statement
                    </span>
                    <div className="flex items-center gap-2 sm:gap-3 mt-1">
                      <h2 className="font-display text-xl sm:text-2xl font-black text-white">{s.student.name}</h2>
                      <span className="rounded bg-white/15 px-2 py-0.5 font-mono text-[11px] sm:text-xs font-semibold text-navy-100 border border-white/20">
                        {s.student.admission_no}
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] sm:text-xs text-navy-200">
                      St Eric High School · Norton, Zimbabwe · Verified Bursar Records
                    </p>
                  </div>

                  <div className="sm:text-right pt-2 sm:pt-0 border-t border-white/10 sm:border-0">
                    <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-navy-300">Net Outstanding Balance</p>
                    <p className={`font-display text-2xl sm:text-3xl font-black ${netBalance > 0 ? "text-crimson-400" : "text-emerald-400"}`}>
                      {Object.keys(s.balance || {}).length
                        ? Object.entries(s.balance)
                            .map(([c, v]: any) => money(v, c))
                            .join(" + ")
                        : money(0)}
                    </p>
                    <span className={`inline-flex items-center gap-1 mt-1 text-[10px] sm:text-xs font-bold px-2 py-0.5 rounded-full ${
                      netBalance > 0 ? "bg-crimson-900/60 text-crimson-200" : "bg-emerald-900/60 text-emerald-200"
                    }`}>
                      {netBalance > 0 ? "Outstanding Payment Due" : "Account Fully Cleared"}
                    </span>
                  </div>
                </div>

                {/* Accounting Metric Cards Strip */}
                <div className="grid grid-cols-2 gap-px bg-line sm:grid-cols-4 border-b border-line">
                  <div className="bg-white p-3 sm:p-4">
                    <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-mute flex items-center gap-1">
                      <TrendingUp size={12} className="text-navy-600" /> Total Invoiced
                    </p>
                    <p className="mt-1 font-display text-base sm:text-xl font-bold text-navy-900">
                      {money(totalBilled)}
                    </p>
                    <p className="text-[10px] sm:text-[11px] text-mute mt-0.5">Fees & levies charged</p>
                  </div>

                  <div className="bg-white p-3 sm:p-4">
                    <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-mute flex items-center gap-1">
                      <TrendingDown size={12} className="text-emerald-600" /> Total Paid
                    </p>
                    <p className="mt-1 font-display text-base sm:text-xl font-bold text-emerald-700">
                      {money(totalPaid)}
                    </p>
                    <p className="text-[10px] sm:text-[11px] text-mute mt-0.5">Receipted credits</p>
                  </div>

                  <div className="bg-white p-3 sm:p-4">
                    <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-mute flex items-center gap-1">
                      <Wallet size={12} className={netBalance > 0 ? "text-crimson-600" : "text-emerald-600"} /> Net Balance
                    </p>
                    <p className={`mt-1 font-display text-base sm:text-xl font-bold ${netBalance > 0 ? "text-crimson-600" : "text-emerald-700"}`}>
                      {money(netBalance)}
                    </p>
                    <p className="text-[10px] sm:text-[11px] text-mute mt-0.5">{netBalance > 0 ? "Payable" : "Zero arrears"}</p>
                  </div>

                  <div className="bg-white p-3 sm:p-4">
                    <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-mute flex items-center gap-1">
                      <Clock size={12} className="text-navy-600" /> Last Payment
                    </p>
                    <p className="mt-1 font-display text-xs sm:text-base font-bold text-navy-900 truncate">
                      {s.last_payment_date ? formatDate(s.last_payment_date) : (s.records?.[0]?.date_paid ? formatDate(s.records[0].date_paid) : "None")}
                    </p>
                    <p className="text-[10px] sm:text-[11px] text-mute mt-0.5">Verified receipt</p>
                  </div>
                </div>

                {/* View Switcher: Accounting Ledger vs Fee Item Breakdown */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between px-3 sm:px-6 py-2.5 sm:py-3 bg-slate-50 border-b border-line gap-2 print:hidden">
                  <div className="flex flex-col sm:flex-row gap-1.5 sm:gap-2 w-full sm:w-auto">
                    <button
                      onClick={() => setActiveTab("ledger")}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                        activeTab === "ledger"
                          ? "bg-navy-800 text-white shadow-xs"
                          : "bg-white text-slate-700 border border-line hover:bg-slate-100"
                      }`}
                    >
                      <FileText size={13} /> Accounting Statement (Debit / Credit)
                    </button>
                    <button
                      onClick={() => setActiveTab("items")}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                        activeTab === "items"
                          ? "bg-navy-800 text-white shadow-xs"
                          : "bg-white text-slate-700 border border-line hover:bg-slate-100"
                      }`}
                    >
                      <FileSpreadsheet size={13} /> Fee Items Breakdown
                    </button>
                  </div>
                  <span className="text-[11px] sm:text-xs text-mute font-medium hidden sm:inline">
                    Statement Date: {new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                  </span>
                </div>

                {/* VIEW 1: ACCOUNTING STATEMENT LEDGER (DEBIT / CREDIT) */}
                {activeTab === "ledger" && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="border-b border-navy-800 bg-navy-900 text-xs font-semibold uppercase tracking-wider text-white">
                        <tr>
                          <th className="px-5 py-3 w-28">Date</th>
                          <th className="px-4 py-3 w-28">Reference #</th>
                          <th className="px-5 py-3">Transaction Description</th>
                          <th className="px-4 py-3 w-32 text-center">Date Paid</th>
                          <th className="px-4 py-3 w-32 text-right">Debit (+)</th>
                          <th className="px-4 py-3 w-32 text-right">Credit (-)</th>
                          <th className="px-5 py-3 w-36 text-right">Running Balance</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-line">
                        {ledger.length > 0 ? (
                          ledger.map((tx: any, idx: number) => {
                            const isCredit = tx.type === "credit";
                            return (
                              <tr key={tx.id || idx} className={`transition ${isCredit ? "bg-emerald-50/30 hover:bg-emerald-50/60" : "bg-white hover:bg-slate-50"}`}>
                                <td className="px-5 py-3 text-xs font-mono text-slate-600 whitespace-nowrap">
                                  {formatDate(tx.date)}
                                </td>
                                <td className="px-4 py-3 font-mono text-xs font-bold text-navy-800">
                                  {tx.ref}
                                </td>
                                <td className="px-5 py-3">
                                  <div className="font-semibold text-navy-900">{tx.description}</div>
                                  <div className="text-[11px] text-mute">
                                    {isCredit ? "Payment received / bursar credited" : "School term charge levied"}
                                  </div>
                                </td>
                                <td className="px-4 py-3 text-center">
                                  {tx.date_paid ? (
                                    <span className="inline-flex items-center gap-1 rounded bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-800 font-mono">
                                      <CheckCircle2 size={12} /> {formatDate(tx.date_paid)}
                                    </span>
                                  ) : (
                                    <span className="text-xs text-mute font-mono">—</span>
                                  )}
                                </td>
                                <td className="px-4 py-3 text-right font-mono text-xs font-bold text-navy-900">
                                  {tx.debit > 0 ? money(tx.debit, tx.currency) : "—"}
                                </td>
                                <td className="px-4 py-3 text-right font-mono text-xs font-bold text-emerald-700">
                                  {tx.credit > 0 ? money(tx.credit, tx.currency) : "—"}
                                </td>
                                <td className="px-5 py-3 text-right font-mono text-xs font-black text-navy-900">
                                  {money(tx.running_balance, tx.currency)}
                                </td>
                              </tr>
                            );
                          })
                        ) : (
                          // Fallback to records if ledger is not populated yet
                          (s.records || []).map((r: any, idx: number) => (
                            <tr key={idx} className="hover:bg-slate-50">
                              <td className="px-5 py-3 text-xs font-mono text-slate-600">{formatDate(r.date_paid)}</td>
                              <td className="px-4 py-3 font-mono text-xs text-navy-800">INV-{idx + 1}</td>
                              <td className="px-5 py-3 font-semibold text-navy-900">{r.fee_type}</td>
                              <td className="px-4 py-3 text-center font-mono text-xs font-bold text-emerald-700">{formatDate(r.date_paid)}</td>
                              <td className="px-4 py-3 text-right font-mono text-xs">{money(r.due, r.currency)}</td>
                              <td className="px-4 py-3 text-right font-mono text-xs text-emerald-700">{money(r.paid, r.currency)}</td>
                              <td className="px-5 py-3 text-right font-mono text-xs font-bold">{money(r.balance, r.currency)}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                      <tfoot className="border-t-2 border-navy-800 bg-navy-50/80 font-bold text-xs uppercase text-navy-900">
                        <tr>
                          <td colSpan={4} className="px-5 py-3 text-right">Account Totals & Net Arrears:</td>
                          <td className="px-4 py-3 text-right font-mono font-black text-navy-900">{money(totalBilled)}</td>
                          <td className="px-4 py-3 text-right font-mono font-black text-emerald-700">{money(totalPaid)}</td>
                          <td className="px-5 py-3 text-right font-mono font-black text-crimson-700">{money(netBalance)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}

                {/* VIEW 2: FEE ITEMS BREAKDOWN */}
                {activeTab === "items" && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="border-b border-line bg-navy-50/60 text-xs font-semibold uppercase tracking-wider text-mute">
                        <tr>
                          <th className="px-5 py-3">Fee Description</th>
                          <th className="px-4 py-3">Total Billed</th>
                          <th className="px-4 py-3">Date Paid</th>
                          <th className="px-4 py-3">Paid to Date</th>
                          <th className="px-4 py-3">Outstanding Balance</th>
                          <th className="px-5 py-3 text-right">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-line">
                        {(s.records || []).map((r: any, i: number) => {
                          const balance = Math.max(0, r.due - r.paid);
                          return (
                            <tr key={i} className="hover:bg-navy-50/20 transition">
                              <td className="px-5 py-3.5 font-semibold text-navy-900">{r.fee_type}</td>
                              <td className="px-4 py-3.5 font-mono text-xs">{money(r.due, r.currency)}</td>
                              <td className="px-4 py-3.5 font-mono text-xs text-navy-700">
                                {r.date_paid ? (
                                  <span className="inline-flex items-center gap-1 font-bold text-emerald-700">
                                    <CheckCircle2 size={12} /> {formatDate(r.date_paid)}
                                  </span>
                                ) : "Unpaid"}
                              </td>
                              <td className="px-4 py-3.5 font-mono text-xs text-emerald-700 font-bold">{money(r.paid, r.currency)}</td>
                              <td className="px-4 py-3.5 font-mono text-xs font-bold text-navy-900">
                                {money(balance, r.currency)}
                              </td>
                              <td className="px-5 py-3.5 text-right">
                                <Badge tone={r.status === "paid" ? "green" : r.status === "part_paid" ? "amber" : "red"}>
                                  {r.status === "paid" ? "Cleared" : r.status === "part_paid" ? "Part Paid" : "Unpaid"}
                                </Badge>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Printable Bursar Stamp Footer */}
                <div className="border-t border-line bg-slate-50 p-6 flex flex-wrap items-center justify-between gap-4 text-xs text-mute">
                  <div>
                    <p className="font-semibold text-navy-900">Bursar Office Signature & Verification Stamp</p>
                    <p className="mt-0.5">St Eric High School · Official Accounts Office · Stand No 2395, Shonhiwa Drive, Norton</p>
                  </div>
                  <div className="text-right">
                    <p className="font-mono text-[11px]">System Generated Reference: SE-BURSAR-{s.student.admission_no}</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">This document serves as an official accounting statement.</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {toast.node}
    </div>
  );
}
