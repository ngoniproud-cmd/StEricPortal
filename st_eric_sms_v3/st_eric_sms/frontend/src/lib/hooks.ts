import { useCallback, useEffect, useState } from "react";
import { api } from "./api";

export function useFetch<T = any>(path: string | null) {
  const [data, setData] = useState<T | null>(null); const [error, setError] = useState(""); const [loading, setLoading] = useState(!!path);
  const load = useCallback(() => { if (!path) { setData(null); setLoading(false); return; } setLoading(true); setError("");
    api<T>(path).then(setData).catch(e => setError(e.message)).finally(() => setLoading(false)); }, [path]);
  useEffect(load, [load]);
  return { data, error, loading, reload: load };
}
