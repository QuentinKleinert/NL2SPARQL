import type { LogRecord } from "../types";
import Button from "./Button";

interface LogsPanelProps {
  items: LogRecord[];
  onUndo: (record: LogRecord) => void;
  limit: number;
  onChangeLimit: (n: number) => void;
}

const statusColors: Record<string, string> = {
  applied: "text-emerald-600",
  failed: "text-rose-600",
  undo_applied: "text-emerald-500",
  undo_failed: "text-rose-500",
};

export default function LogsPanel({
  items,
  onUndo,
  limit,
  onChangeLimit,
}: LogsPanelProps) {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-xs uppercase tracking-wider text-slate-500">
          Einträge
        </label>
        <select
          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-600 shadow-inner"
          value={limit}
          onChange={(e) => onChangeLimit(Number(e.target.value))}
        >
          {[10, 20, 50, 100].map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </div>

      <div className="relative pl-6">
        <span className="absolute inset-y-3 left-1 w-px rounded-full bg-gradient-to-b from-sky-400/70 via-slate-200/60 to-transparent" aria-hidden />

        {items.length === 0 && (
          <p className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-500 shadow-sm">
            Noch keine Änderungen durchgeführt.
          </p>
        )}

        <ol className="space-y-5">
          {items.map((log, idx) => {
            const status = log.status?.toLowerCase() ?? "";
            const color = statusColors[status] ?? "text-slate-200";
            const ts = new Date(log.ts);
            const stamp = Number.isNaN(ts.getTime())
              ? log.ts
              : ts.toLocaleString();
            const canUndo = status === "applied" && !!log.undo_sparql;

            return (
              <li key={`${log.ts}-${idx}`} className="relative">
                <span className="absolute -left-6 mt-2 flex h-3.5 w-3.5 items-center justify-center">
                  <span className="h-full w-full rounded-full bg-sky-400 shadow shadow-sky-200" />
                </span>

                <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex flex-wrap items-start gap-3">
                    <div className="space-y-1">
                      <p className="text-[11px] uppercase tracking-[0.28em] text-slate-400">
                        {stamp}
                      </p>
                      <p className={`text-sm font-semibold ${color}`}>
                        {log.status?.toUpperCase()}
                      </p>
                    </div>
                    <div className="ml-auto flex items-center gap-2">
                      {canUndo && (
                        <Button
                          small
                          variant="ghost"
                          icon={
                            <svg
                              className="h-3.5 w-3.5 text-rose-300"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="1.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              aria-hidden
                            >
                              <polyline points="1 4 1 10 7 10" />
                              <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
                            </svg>
                          }
                          onClick={() => onUndo(log)}
                        >
                          Undo
                        </Button>
                      )}
                    </div>
                  </div>

                  <details className="mt-3 space-y-2 text-xs text-slate-500">
                    <summary className="cursor-pointer text-slate-500 hover:text-slate-700">
                      Details anzeigen
                    </summary>
                    <div className="grid gap-2">
                      <div>
                        <p className="font-semibold text-slate-600">SPARQL</p>
                        <pre className="mt-1 rounded-2xl bg-slate-100 p-3 text-[11px] leading-relaxed text-slate-700 shadow-inner whitespace-pre-wrap">
                          {log.sparql}
                        </pre>
                      </div>
                      {Boolean(log.explain) && (
                        <div>
                          <p className="font-semibold text-slate-600">Explain</p>
                          <pre className="mt-1 rounded-2xl bg-slate-100 p-3 text-[11px] leading-relaxed text-slate-700 shadow-inner whitespace-pre-wrap">
                            {JSON.stringify(log.explain, null, 2)}
                          </pre>
                        </div>
                      )}
                      {Boolean(log.validation) && (
                        <div>
                          <p className="font-semibold text-slate-600">Validation</p>
                          <pre className="mt-1 rounded-2xl bg-slate-100 p-3 text-[11px] leading-relaxed text-slate-700 shadow-inner whitespace-pre-wrap">
                            {JSON.stringify(log.validation, null, 2)}
                          </pre>
                        </div>
                      )}
                      {log.error && (
                        <div>
                          <p className="font-semibold text-rose-600">Error</p>
                          <pre className="mt-1 rounded-2xl bg-rose-50 p-3 text-[11px] leading-relaxed text-rose-700 shadow-inner whitespace-pre-wrap">
                            {log.error}
                          </pre>
                        </div>
                      )}
                    </div>
                  </details>
                </article>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
