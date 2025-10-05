import type { ReactNode } from "react";

interface SectionCardProps {
  title?: string;
  description?: string;
  eyebrow?: string;
  icon?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  id?: string;
  padding?: "default" | "compact";
  tone?: "neutral" | "accent" | "success" | "danger" | "glass";
  className?: string;
}

export default function SectionCard({
  title,
  description,
  eyebrow,
  icon,
  actions,
  children,
  id,
  padding = "default",
  tone = "neutral",
  className = "",
}: SectionCardProps) {
  const bodyPadding = padding === "compact" ? "px-6 py-5" : "px-9 py-7";

  const tones: Record<NonNullable<SectionCardProps["tone"]>, string> = {
    neutral:
      "border-slate-200 bg-white shadow-sm",
    accent:
      "border-sky-200 bg-white shadow-sm",
    success:
      "border-emerald-200 bg-white shadow-sm",
    danger:
      "border-rose-200 bg-white shadow-sm",
    glass:
      "border-slate-100 bg-white shadow-sm",
  };

  return (
    <section
      id={id}
      className={`rounded-3xl transition-transform duration-200 hover:-translate-y-0.5 ${tones[tone]} ${className}`}
    >
      {(title || description || actions) && (
        <header className="flex flex-wrap items-start gap-4 border-b border-slate-100 px-9 py-6">
          <div className="flex flex-1 items-start gap-3">
            {icon && (
              <span className="hidden rounded-2xl bg-slate-100 p-2 text-brand-500 shadow-inner shadow-slate-200/60 sm:block">
                {icon}
              </span>
            )}
            <div className="space-y-1">
              {eyebrow && (
                <p className="text-xs uppercase tracking-[0.35em] text-brand-500/80">
                  {eyebrow}
                </p>
              )}
              {title && (
                <h2 className="text-xl font-semibold tracking-tight text-slate-900">
                  {title}
                </h2>
              )}
              {description && (
                <p className="max-w-2xl text-sm text-slate-500">{description}</p>
              )}
            </div>
          </div>
          {actions && <div className="ml-auto flex items-center gap-2 text-sm text-slate-600">{actions}</div>}
        </header>
      )}
      <div className={`${bodyPadding} space-y-6`}>{children}</div>
    </section>
  );
}
