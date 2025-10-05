interface TokenBadgeProps {
  secondsLeft: number;
}

export default function TokenBadge({ secondsLeft }: TokenBadgeProps) {
  const isCritical = secondsLeft <= 15;
  const pct = Math.min(1, Math.max(0, secondsLeft / 600));
  const color = isCritical
    ? "border-rose-200 bg-rose-50 text-rose-600"
    : "border-emerald-200 bg-emerald-50 text-emerald-600";
  const statusText = isCritical ? "Token läuft ab" : "Token aktiv";

  return (
    <span
      className={`inline-flex items-center gap-3 rounded-full border px-4 py-1.5 text-xs font-semibold tracking-wide shadow ${color}`}
      role="status"
      aria-live="polite"
    >
      <span className="relative inline-flex h-3 w-3 flex-shrink-0 items-center justify-center">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-current/30" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-current" />
      </span>
      <span className="uppercase tracking-[0.25em] text-slate-500">{statusText}</span>
      <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-medium text-slate-600">
        {secondsLeft}s
      </span>
      <span className="ml-2 hidden h-1 w-16 overflow-hidden rounded-full bg-white sm:block">
        <span
          className="block h-full rounded-full bg-slate-300 transition-[width]"
          style={{ width: `${Math.max(8, pct * 100)}%` }}
        />
      </span>
    </span>
  );
}
