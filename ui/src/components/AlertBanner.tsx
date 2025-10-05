import type { ReactNode } from "react";

interface AlertBannerProps {
  kind: "success" | "error" | "info";
  title?: string;
  children: ReactNode;
}

const STYLES: Record<AlertBannerProps["kind"], { wrap: string; icon: string }> = {
  success: {
    wrap: "border-emerald-200 bg-emerald-50 text-emerald-700",
    icon: "text-emerald-500",
  },
  error: {
    wrap: "border-rose-200 bg-rose-50 text-rose-700",
    icon: "text-rose-500",
  },
  info: {
    wrap: "border-sky-200 bg-sky-50 text-sky-700",
    icon: "text-sky-500",
  },
};

const ICONS: Record<AlertBannerProps["kind"], ReactNode> = {
  success: (
    <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
      <path
        fillRule="evenodd"
        d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm3.707-9.707a1 1 0 0 0-1.414-1.414L9 10.586 7.707 9.293a1 1 0 1 0-1.414 1.414l2 2a1 1 0 0 0 1.414 0l4-4Z"
        clipRule="evenodd"
      />
    </svg>
  ),
  error: (
    <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
      <path
        fillRule="evenodd"
        d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm.75-11.5a.75.75 0 0 0-1.5 0v4a.75.75 0 0 0 1.5 0v-4Zm0 6.5a.75.75 0 1 0-1.5 0 .75.75 0 0 0 1.5 0Z"
        clipRule="evenodd"
      />
    </svg>
  ),
  info: (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 16v-4" />
      <path d="M12 8h.01" />
    </svg>
  ),
};

export default function AlertBanner({ kind, title, children }: AlertBannerProps) {
  const style = STYLES[kind];
  return (
    <div
      className={`flex items-start gap-3 rounded-2xl border px-5 py-4 text-sm shadow-sm ${style.wrap}`}
      role={kind === "error" ? "alert" : "status"}
    >
      <span className={`mt-0.5 ${style.icon}`}>{ICONS[kind]}</span>
      <div className="space-y-1 text-left leading-relaxed">
        {title && <p className="text-base font-semibold tracking-tight">{title}</p>}
        <div>{children}</div>
      </div>
    </div>
  );
}
