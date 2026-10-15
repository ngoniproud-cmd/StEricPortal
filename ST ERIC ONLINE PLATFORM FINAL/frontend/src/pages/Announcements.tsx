import { useMemo, useState } from "react";
import {
  AlertCircle,
  Award,
  BookOpen,
  Calendar,
  Check,
  Clock,
  Copy,
  Flame,
  GraduationCap,
  Megaphone,
  Pin,
  Plus,
  Search,
  Send,
  Sparkles,
  Trophy,
  Users,
} from "lucide-react";
import { api, session } from "../lib/api";
import { useFetch } from "../lib/hooks";
import { fmtDate } from "../lib/zim";
import { Badge, Empty, ErrorNote, Field, PageHeader, Select, Spinner, useToast } from "../components/ui";

function getAnnouncementMeta(title: string, body: string) {
  const text = (title + " " + body).toLowerCase();
  if (text.includes("excellence") || text.includes("exam") || text.includes("attainment") || text.includes("marks") || text.includes("aggregate") || text.includes("congratulat")) {
    return {
      category: "Academic & Honours",
      badgeTone: "gold" as const,
      borderClass: "border-l-gold-500",
      accentBg: "bg-gold-50/50",
      badgeBg: "bg-amber-100 text-amber-900 border-amber-200",
      icon: Award,
      isUrgent: false,
    };
  }
  if (text.includes("sport") || text.includes("fixture") || text.includes("rugby") || text.includes("soccer") || text.includes("netball") || text.includes("basketball") || text.includes("match")) {
    return {
      category: "Sports & Fixtures",
      badgeTone: "green" as const,
      borderClass: "border-l-emerald-600",
      accentBg: "bg-emerald-50/40",
      badgeBg: "bg-emerald-100 text-emerald-900 border-emerald-200",
      icon: Trophy,
      isUrgent: false,
    };
  }
  if (text.includes("consultation") || text.includes("parent") || text.includes("guardian") || text.includes("meeting") || text.includes("agm")) {
    return {
      category: "Consultation & Community",
      badgeTone: "amber" as const,
      borderClass: "border-l-amber-500",
      accentBg: "bg-amber-50/40",
      badgeBg: "bg-amber-100 text-amber-900 border-amber-200",
      icon: Users,
      isUrgent: false,
    };
  }
  if (text.includes("library") || text.includes("past paper") || text.includes("digital") || text.includes("book") || text.includes("revision")) {
    return {
      category: "Library & Academic Resources",
      badgeTone: "navy" as const,
      borderClass: "border-l-navy-700",
      accentBg: "bg-navy-50/50",
      badgeBg: "bg-navy-100 text-navy-900 border-navy-200",
      icon: BookOpen,
      isUrgent: false,
    };
  }
  if (text.includes("urgent") || text.includes("deadline") || text.includes("fee") || text.includes("warning") || text.includes("notice") || text.includes("attention")) {
    return {
      category: "Important Notice",
      badgeTone: "crimson" as const,
      borderClass: "border-l-crimson-600",
      accentBg: "bg-crimson-50/40",
      badgeBg: "bg-red-100 text-red-900 border-red-200",
      icon: AlertCircle,
      isUrgent: true,
    };
  }
  return {
    category: "General Circular",
    badgeTone: "navy" as const,
    borderClass: "border-l-navy-500",
    accentBg: "bg-slate-50",
    badgeBg: "bg-slate-100 text-slate-800 border-slate-200",
    icon: Megaphone,
    isUrgent: false,
  };
}

function parseContent(body: string) {
  const trimmed = body.trim();
  const sentences = trimmed.split(/(?<=[.!?])\s+/);
  const lead = sentences[0] || trimmed;
  const rest = sentences.slice(1).join(" ");

  // Extract quick tags like times or special mentions
  const tags: string[] = [];
  const timeMatch = trimmed.match(/\b\d{1,2}:\d{2}(?:\s*(?:to|-)\s*\d{1,2}:\d{2})?\b/i);
  if (timeMatch) tags.push(`Time: ${timeMatch[0]}`);

  const dayMatch = trimmed.match(/\b(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\b/i);
  if (dayMatch) tags.push(`Day: ${dayMatch[0]}`);

  if (/uniform/i.test(trimmed)) tags.push("Uniform Required");
  if (/zimsec/i.test(trimmed)) tags.push("ZIMSEC Verified");
  if (/form 1/i.test(trimmed)) tags.push("Form 1");
  if (/form 5/i.test(trimmed) || /a-level/i.test(trimmed)) tags.push("Form 5 (A-Level)");

  return { lead, rest, tags };
}

function DateTicket({ dateStr }: { dateStr: string }) {
  const d = new Date(dateStr);
  const isValid = !isNaN(d.getTime());
  const month = isValid ? d.toLocaleDateString("en-US", { month: "short" }).toUpperCase() : "OCT";
  const day = isValid ? d.getDate() : 2;
  const dayStr = day < 10 ? `0${day}` : `${day}`;
  return (
    <div className="flex flex-col items-center justify-center shrink-0 w-13 h-15 rounded-xl border border-slate-200 overflow-hidden shadow-xs bg-white text-center">
      <div className="w-full bg-[#1a3563] text-white text-[10px] font-black uppercase py-0.5 tracking-wider">
        {month}
      </div>
      <div className="flex-1 flex items-center justify-center text-lg font-black text-slate-900 font-mono leading-none">
        {dayStr}
      </div>
    </div>
  );
}

export default function Announcements() {
  const role = session.role();
  const canPost = role === "admin" || role === "teacher";
  const q = useFetch("/announcements");
  const toast = useToast();

  const [f, setF] = useState({ title: "", body: "", audience: role === "admin" ? "all" : "students" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [showPost, setShowPost] = useState(false);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  async function post() {
    setBusy(true);
    setErr("");
    try {
      await api("/announcements", { method: "POST", json: f });
      setF({ ...f, title: "", body: "" });
      setShowPost(false);
      toast.show("Announcement published successfully.");
      q.reload();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const allItems = q.data ?? [];

  const items = useMemo(() => {
    return allItems.filter((a: any) => {
      const matchAudience = filter === "all" || a.audience === filter;
      const matchSearch =
        !search.trim() ||
        a.title.toLowerCase().includes(search.toLowerCase()) ||
        a.body.toLowerCase().includes(search.toLowerCase());
      return matchAudience && matchSearch;
    });
  }, [allItems, filter, search]);

  const featured = items.length > 0 ? items[0] : null;
  const standardItems = items.length > 1 ? items.slice(1) : [];

  function copyNotice(a: any) {
    const text = `${a.title}\n\n${a.body}\n\n— St Eric High School Official Announcement (${fmtDate(a.created_at)})`;
    navigator.clipboard.writeText(text);
    setCopiedId(a.id);
    toast.show("Announcement copied to clipboard.");
    setTimeout(() => setCopiedId(null), 2500);
  }

  return (
    <div className="mx-auto max-w-4xl page-enter pb-16 space-y-6">
      <PageHeader
        eyebrow="Official School Gazette"
        title="Announcements & Bulletins"
      >
        {canPost && (
          <button
            className="btn-primary flex items-center gap-2"
            onClick={() => setShowPost(s => !s)}
          >
            <Plus size={16} />
            <span>{showPost ? "Cancel" : "Post Announcement"}</span>
          </button>
        )}
      </PageHeader>

      {/* Composer Card */}
      {canPost && showPost && (
        <div className="card-static p-6 space-y-5 border-2 border-navy-200 shadow-elevated animate-fade-in">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h2 className="text-sm font-extrabold uppercase tracking-wider text-navy-950 flex items-center gap-2">
              <Megaphone size={16} className="text-crimson-600" /> New Official Announcement
            </h2>
            <span className="text-xs text-slate-400 font-medium">Broadcasts instantly to portals</span>
          </div>

          <Field label="Announcement Headline">
            <input
              className="input font-semibold"
              placeholder="e.g. Academic Consultation Day / Inter-School Fixtures"
              value={f.title}
              onChange={e => setF({ ...f, title: e.target.value })}
            />
          </Field>

          <Field label="Notice Body & Details">
            <textarea
              className="input min-h-32 text-sm leading-relaxed"
              placeholder="Write the full message. The opening sentence will automatically be formatted as a high-contrast executive lead."
              value={f.body}
              onChange={e => setF({ ...f, body: e.target.value })}
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end pt-2">
            <Field label="Target Audience">
              <Select value={f.audience} onChange={v => setF({ ...f, audience: v })}>
                {role === "admin" && <option value="all">Whole School (Everyone)</option>}
                <option value="students">Students Only</option>
                <option value="parents">Parents & Guardians</option>
                {role === "admin" && <option value="teachers">Teaching Staff Only</option>}
              </Select>
            </Field>

            <div className="flex items-center gap-3">
              <button
                className="btn-ghost"
                onClick={() => setShowPost(false)}
              >
                Dismiss
              </button>
              <button
                className="btn-primary flex items-center gap-2"
                onClick={post}
                disabled={busy || f.title.trim().length < 3 || f.body.trim().length < 3}
              >
                <Send size={15} />
                <span>{busy ? "Broadcasting..." : "Publish Circular"}</span>
              </button>
            </div>
          </div>
          <ErrorNote msg={err} />
        </div>
      )}

      {/* Control Strip: Search & Filter Tabs */}
      <div className="card-static p-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        {/* Search Input */}
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            className="input !pl-10 text-xs"
            placeholder="Search by keywords, subject, or dates..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {/* Audience Filter Tabs */}
        <div className="flex flex-wrap items-center gap-1.5">
          {[
            { key: "all", label: "All Bulletins" },
            { key: "students", label: "Students" },
            { key: "parents", label: "Parents" },
            ...(role === "admin" || role === "teacher" ? [{ key: "teachers", label: "Staff" }] : []),
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-150 cursor-pointer ${
                filter === tab.key
                  ? "bg-[#1a3563] text-white shadow-xs"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Announcements Stream */}
      {q.loading ? (
        <Spinner />
      ) : !items.length ? (
        <Empty
          title={search ? "No matching announcements" : "No bulletins right now"}
          hint={search ? "Try searching with different terms." : "New school circulars and announcements will appear here."}
        />
      ) : (
        <div className="space-y-6">
          {/* FEATURED / LATEST HERO BULLETIN */}
          {featured && (
            <div className="relative overflow-hidden rounded-2xl border-2 border-[#1a3563] bg-white shadow-elevated transition-all">
              {/* Top Banner Strip */}
              <div className="bg-gradient-to-r from-[#0d1a33] via-[#1a3563] to-[#2b4a78] px-6 py-2.5 text-white flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="flex h-2 w-2 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                  </span>
                  <span className="text-[11px] font-black uppercase tracking-widest text-[#f87171]">
                    Latest Official Bulletin
                  </span>
                </div>
                <span className="text-[11px] font-semibold text-slate-300">
                  {fmtDate(featured.created_at)}
                </span>
              </div>

              {/* Main Content Area */}
              <div className="p-6 sm:p-8 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    {(() => {
                      const meta = getAnnouncementMeta(featured.title, featured.body);
                      const Icon = meta.icon;
                      return (
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold uppercase tracking-wide border ${meta.badgeBg}`}>
                          <Icon size={13} />
                          <span>{meta.category}</span>
                        </span>
                      );
                    })()}
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider bg-slate-100 text-slate-700 border border-slate-200">
                      Audience: {featured.audience === "all" ? "Whole School" : featured.audience}
                    </span>
                  </div>

                  <button
                    onClick={() => copyNotice(featured)}
                    className="flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-navy-900 transition cursor-pointer"
                    title="Copy announcement"
                  >
                    {copiedId === featured.id ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                    <span>{copiedId === featured.id ? "Copied" : "Copy"}</span>
                  </button>
                </div>

                {/* Big Punchy Title */}
                <h2 className="font-display text-xl sm:text-2xl font-black text-slate-900 leading-tight">
                  {featured.title}
                </h2>

                {/* Catchy Executive Lead Callout */}
                {(() => {
                  const { lead, rest, tags } = parseContent(featured.body);
                  return (
                    <div className="space-y-4">
                      <div className="rounded-xl border-l-4 border-l-[#c41e2a] bg-slate-50 p-4 sm:p-5">
                        <p className="text-base sm:text-lg font-bold text-slate-900 leading-snug">
                          {lead}
                        </p>
                      </div>

                      {rest && (
                        <p className="text-sm sm:text-[15px] text-slate-600 leading-relaxed font-normal">
                          {rest}
                        </p>
                      )}

                      {/* Quick Info Tags */}
                      {tags.length > 0 && (
                        <div className="flex flex-wrap items-center gap-2 pt-1">
                          {tags.map((t, idx) => (
                            <span
                              key={idx}
                              className="inline-flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-bold bg-navy-50 text-[#1a3563] border border-navy-200"
                            >
                              <Clock size={12} className="text-crimson-600" /> {t}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Footer Stamp */}
                <div className="mt-6 pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
                  <div className="flex items-center gap-2.5">
                    <div className="h-7 w-7 rounded-lg bg-[#1a3563] text-white font-bold flex items-center justify-center text-xs shadow-xs">
                      SE
                    </div>
                    <div>
                      <p className="font-extrabold text-slate-800 leading-none">
                        {featured.by || "Office of the Headmaster"}
                      </p>
                      <p className="text-[10px] text-slate-400 mt-0.5">St Eric High School · Official Circular</p>
                    </div>
                  </div>
                  <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                    Verified Release
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* STANDARD BULLETIN STREAM (Cards with Date Tickets) */}
          {standardItems.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 pt-2">
                <Calendar size={16} className="text-slate-400" />
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
                  Prior School Bulletins
                </h3>
              </div>

              {standardItems.map((a: any) => {
                const meta = getAnnouncementMeta(a.title, a.body);
                const Icon = meta.icon;
                const { lead, rest, tags } = parseContent(a.body);

                return (
                  <article
                    key={a.id}
                    className={`card-static overflow-hidden border border-slate-200/90 border-l-4 ${meta.borderClass} bg-white p-5 sm:p-6 transition-all duration-200 hover:shadow-card hover:border-slate-300`}
                  >
                    <div className="flex items-start gap-4">
                      {/* Date Ticket on the Left */}
                      <DateTicket dateStr={a.created_at} />

                      {/* Main Body */}
                      <div className="min-w-0 flex-1 space-y-2.5">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold uppercase tracking-wider border ${meta.badgeBg}`}>
                              <Icon size={12} />
                              <span>{meta.category}</span>
                            </span>
                            <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                              {a.audience === "all" ? "Whole School" : a.audience}
                            </span>
                          </div>

                          <button
                            onClick={() => copyNotice(a)}
                            className="text-xs font-semibold text-slate-400 hover:text-navy-900 transition flex items-center gap-1 cursor-pointer"
                            title="Copy text"
                          >
                            {copiedId === a.id ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
                            <span className="text-[11px]">{copiedId === a.id ? "Copied" : "Copy"}</span>
                          </button>
                        </div>

                        {/* Title */}
                        <h2 className="text-base sm:text-lg font-bold text-slate-900 leading-snug tracking-tight">
                          {a.title}
                        </h2>

                        {/* Lead Sentence Highlight */}
                        <div className="rounded-lg bg-slate-50 border border-slate-100 p-3">
                          <p className="text-sm font-semibold text-slate-800 leading-relaxed">
                            {lead}
                          </p>
                        </div>

                        {/* Remaining Text */}
                        {rest && (
                          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                            {rest}
                          </p>
                        )}

                        {/* Highlight Tags */}
                        {tags.length > 0 && (
                          <div className="flex flex-wrap items-center gap-1.5 pt-1">
                            {tags.map((t, idx) => (
                              <span
                                key={idx}
                                className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[10px] font-bold bg-navy-50 text-[#1a3563] border border-navy-100"
                              >
                                {t}
                              </span>
                            ))}
                          </div>
                        )}

                        {/* Footer */}
                        <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                          <span>Issued by: <b className="text-slate-700 font-bold">{a.by || "Administration"}</b></span>
                          <span>St Eric High School</span>
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      )}
      {toast.node}
    </div>
  );
}
