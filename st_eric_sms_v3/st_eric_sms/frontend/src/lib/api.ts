const BASE = "/api/v1";
const store = { get: (k: string) => localStorage.getItem(k) };
export const session = {
  token: () => store.get("token"), role: () => store.get("role") ?? "", name: () => store.get("name") ?? "",
  mustChange: () => store.get("must_change") === "1",
  set: (d: { access_token: string; role: string; full_name: string; must_change_password: boolean }) => {
    localStorage.setItem("token", d.access_token); localStorage.setItem("role", d.role);
    localStorage.setItem("name", d.full_name); localStorage.setItem("must_change", d.must_change_password ? "1" : "0");
  },
  passwordChanged: () => localStorage.setItem("must_change", "0"),
  clear: () => { ["token", "role", "name", "must_change"].forEach(k => localStorage.removeItem(k)); if ("caches" in window) caches.delete("api-v1"); },
};

async function fail(res: Response): Promise<never> {
  if (res.status === 401 && session.token()) { session.clear(); location.href = "/login"; }
  const body = await res.json().catch(() => ({}));
  const d = body.detail;
  throw new Error(typeof d === "string" ? d : Array.isArray(d) ? d.map((x: any) => x.msg).join(". ") : "Something went wrong. Please try again.");
}
const auth = (): Record<string, string> => (session.token() ? { Authorization: `Bearer ${session.token()}` } : {});

export async function api<T = any>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const { json, ...rest } = init;
  const res = await fetch(BASE + path, { ...rest, headers: { ...(json !== undefined ? { "Content-Type": "application/json" } : {}), ...auth(), ...rest.headers }, body: json !== undefined ? JSON.stringify(json) : rest.body });
  if (!res.ok) return fail(res);
  return res.json();
}
export async function upload<T = any>(path: string, form: FormData, method = "POST"): Promise<T> {
  const res = await fetch(BASE + path, { method, headers: auth(), body: form });
  if (!res.ok) return fail(res);
  return res.json();
}
/** Fetch a protected file, then open it (inline) or save it. Browsers can't send our token on plain links. */
export async function openFile(path: string, opts: { save?: string } = {}) {
  const res = await fetch(BASE + path, { headers: auth() });
  if (!res.ok) return fail(res);
  const url = URL.createObjectURL(await res.blob());
  if (opts.save) { const a = document.createElement("a"); a.href = url; a.download = opts.save; a.click(); }
  else window.open(url, "_blank");
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
export async function login(username: string, password: string) {
  const res = await fetch(BASE + "/auth/login", { method: "POST", body: new URLSearchParams({ username, password }) });
  if (!res.ok) return fail(res);
  const d = await res.json(); session.set(d); return d;
}
