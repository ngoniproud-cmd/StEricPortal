export const currentTerm = () => { const m = new Date().getMonth() + 1; return m <= 4 ? 1 : m <= 8 ? 2 : 3; };
export const currentYear = () => new Date().getFullYear();
export const fmtDate = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString("en-GB") : "");   // DD/MM/YYYY
export const fmtSize = (b: number) => (b > 1e6 ? `${(b / 1e6).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1e3))} KB`);
export const KINDS: Record<string, string> = { textbook: "Textbook", notes: "Notes", past_paper: "Past paper", marking_scheme: "Marking scheme", other: "Other" };
