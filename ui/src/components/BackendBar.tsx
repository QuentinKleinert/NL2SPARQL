import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getBackendBase, setBackendBase, health } from "../lib/api";

export default function BackendBar() {
  const qc = useQueryClient();
  const [url, setUrl] = useState(getBackendBase());

  useEffect(() => setUrl(getBackendBase()), []);

  const healthQ = useQuery({
    queryKey: ["health", getBackendBase()],
    queryFn: health,
    refetchInterval: 8000,
  });

  const save = () => {
    setBackendBase(url);
    qc.invalidateQueries(); // alles neu fetchen
  };

  const status = healthQ.isLoading
    ? "lädt…"
    : healthQ.isError
      ? "❌"
      : healthQ.data?.ok
        ? "✅"
        : "⚠️";

  return (
    <div className="flex items-center gap-2 bg-slate-800 px-3 py-2 rounded-xl">
      <span className="text-xs text-slate-300">Backend:</span>
      <input
        className="px-2 py-1 rounded bg-slate-900 border border-slate-700 w-[360px]"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
      />
      <button
        onClick={save}
        className="px-3 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white text-sm"
      >
        Save
      </button>
      <span className="text-sm">{status}</span>
    </div>
  );
}
