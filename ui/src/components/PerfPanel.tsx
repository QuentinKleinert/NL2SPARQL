import type { PerfMetrics } from "../types";

interface PerfPanelProps {
  metrics: PerfMetrics | null;
  minutes: number;
  onChangeWindow: (minutes: number) => void;
  onRefresh: () => void;
  loading?: boolean;
}

export default function PerfPanel({
  metrics,
  minutes,
  onChangeWindow,
  onRefresh,
  loading,
}: PerfPanelProps) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-xs uppercase tracking-[0.38em] text-sky-500">
          Auswertung
        </span>
        <select
          className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-600 shadow-inner"
          value={minutes}
          onChange={(e) => onChangeWindow(Number(e.target.value))}
        >
          {[15, 30, 60, 180].map((n) => (
            <option key={n} value={n}>
              {n} min
            </option>
          ))}
        </select>
        <button
          onClick={onRefresh}
          className="rounded-xl border border-sky-300 bg-sky-100 px-4 py-1.5 text-xs font-semibold tracking-wide text-sky-700 shadow-sm transition hover:-translate-y-0.5"
        >
          {loading ? "Aktualisiere…" : "Neu laden"}
        </button>
      </div>

      {!metrics && (
        <p className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-500 shadow-sm">
          Keine Messwerte im aktuellen Zeitraum.
        </p>
      )}

      {metrics && (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <StatCard title="HTTP" stats={metrics.http} tone="neutral" />
            <StatCard title="Fuseki SELECT" stats={metrics.fuseki.select} tone="accent" />
            <StatCard title="Fuseki UPDATE" stats={metrics.fuseki.update} tone="danger" />
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs uppercase tracking-[0.38em] text-slate-500">
              Häufigste Pfade
            </p>
            {metrics.top_http_paths.length === 0 ? (
              <p className="mt-2 text-sm text-slate-500">
                Noch keine Aufrufe im Zeitfenster.
              </p>
            ) : (
              <ul className="mt-3 space-y-2 text-sm text-slate-600">
                {metrics.top_http_paths.map((item) => (
                  <li
                    key={`${item.path}-${item.count}`}
                    className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-3 py-2 shadow-sm"
                  >
                    <code className="text-xs text-slate-500">{item.path}</code>
                    <span className="text-sm text-slate-700">{item.count}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({
  title,
  stats,
  tone = "neutral",
}: {
  title: string;
  stats: { n: number; p50_ms: number; p95_ms: number; max_ms: number };
  tone?: "neutral" | "accent" | "danger";
}) {
  const gradients: Record<string, string> = {
    neutral: "border-slate-200 bg-white shadow-sm",
    accent: "border-sky-200 bg-white shadow-sm",
    danger: "border-rose-200 bg-white shadow-sm",
  };
  const maxValue = Math.max(stats.p95_ms, stats.max_ms, 1);
  return (
    <div className={`rounded-3xl border p-5 ${gradients[tone]}`}>
      <p className="text-xs uppercase tracking-[0.35em] text-slate-500">{title}</p>
      <dl className="mt-4 space-y-3 text-sm text-slate-700">
        <div className="flex items-center justify-between">
          <dt className="text-slate-500">Anzahl</dt>
          <dd className="font-semibold text-slate-800">{stats.n}</dd>
        </div>
        <MetricBar label="p50" value={stats.p50_ms} max={maxValue} />
        <MetricBar label="p95" value={stats.p95_ms} max={maxValue} />
        <MetricBar label="max" value={stats.max_ms} max={maxValue} bold />
      </dl>
    </div>
  );
}

function MetricBar({
  label,
  value,
  max,
  bold,
}: {
  label: string;
  value: number;
  max: number;
  bold?: boolean;
}) {
  const pct = Math.min(1, max === 0 ? 0 : value / max);
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs text-slate-500">
        <span>{label}</span>
        <span className={bold ? "font-semibold text-slate-800" : "text-slate-600"}>
          {value} ms
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-gradient-to-r from-sky-400 via-sky-500 to-sky-300"
          style={{ width: `${Math.max(8, pct * 100)}%` }}
        />
      </div>
    </div>
  );
}
