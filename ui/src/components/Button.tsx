import React from "react";

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  loading?: boolean;
  variant?: "neutral" | "primary" | "danger";
  small?: boolean;
};

export default function Button({
  loading,
  variant = "neutral",
  small,
  className = "",
  children,
  ...rest
}: Props) {
  const base =
    "inline-flex items-center justify-center rounded border text-sm transition";
  const sizes = small ? "px-2 py-1" : "px-3 py-1.5";

  const variants = {
    neutral: "bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-100",
    primary: "bg-indigo-600 hover:bg-indigo-500 border-indigo-600 text-white",
    danger: "bg-rose-600 hover:bg-rose-500 border-rose-600 text-white",
  } as const;

  return (
    <button
      disabled={loading || rest.disabled}
      className={`${base} ${sizes} ${variants[variant]} ${
        loading ? "opacity-70 cursor-progress" : ""
      } ${className}`}
      {...rest}
    >
      {loading && (
        <span className="mr-2 inline-block h-3 w-3 animate-spin rounded-full border-2 border-white/60 border-t-transparent" />
      )}
      {children}
    </button>
  );
}
