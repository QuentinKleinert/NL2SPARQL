import React from "react";

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  loading?: boolean;
  variant?: "neutral" | "primary" | "danger" | "ghost";
  small?: boolean;
  icon?: React.ReactNode;
};

export default function Button({
  loading,
  variant = "neutral",
  small,
  className = "",
  icon,
  children,
  ...rest
}: Props) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-xl border text-sm font-medium tracking-tight transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:cursor-not-allowed";
  const sizes = small ? "px-3 py-1.5 text-xs" : "px-4.5 py-2.5";

  const variants = {
    neutral:
      "border-slate-200 bg-white text-slate-700 shadow-sm hover:-translate-y-0.5 hover:border-sky-300 hover:text-slate-900 disabled:translate-y-0 disabled:opacity-60",
    primary:
      "border-sky-500/70 bg-gradient-to-r from-sky-500 to-sky-600 text-white shadow-lg shadow-sky-200 hover:-translate-y-0.5 hover:from-sky-500 hover:to-sky-500 disabled:translate-y-0 disabled:opacity-60",
    danger:
      "border-rose-500/70 bg-rose-500 text-white shadow hover:-translate-y-0.5 hover:bg-rose-600 disabled:translate-y-0 disabled:opacity-60",
    ghost:
      "border-transparent bg-transparent text-slate-500 hover:border-slate-200 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50",
  } as const;

  return (
    <button
      disabled={loading || rest.disabled}
      className={`${base} ${sizes} ${variants[variant]} ${
        loading ? "cursor-progress opacity-70" : ""
      } ${className}`}
      {...rest}
    >
      {loading ? (
        <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-sky-500/70 border-t-transparent" />
      ) : (
        icon ?? null
      )}
      <span className="inline-flex items-center gap-1">{children}</span>
    </button>
  );
}
