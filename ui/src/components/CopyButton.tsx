import { useMemo, useState } from "react";
import Button from "./Button";

export default function CopyButton({
  getText,
  label = "Copy",
}: {
  getText: () => string;
  label?: string;
}) {
  const [state, setState] = useState<"idle" | "ok" | "err">("idle");

  const doCopy = async () => {
    try {
      await navigator.clipboard.writeText(getText() || "");
      setState("ok");
      setTimeout(() => setState("idle"), 1200);
    } catch {
      setState("err");
      setTimeout(() => setState("idle"), 1800);
    }
  };

  const icon = useMemo(() => {
    if (state === "ok") {
      return (
        <svg
          className="h-4 w-4 text-emerald-300"
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M16.707 5.293a1 1 0 0 1 0 1.414l-7.25 7.25a1 1 0 0 1-1.414 0l-3-3a1 1 0 1 1 1.414-1.414l2.293 2.293 6.543-6.543a1 1 0 0 1 1.414 0Z"
            clipRule="evenodd"
          />
        </svg>
      );
    }
    if (state === "err") {
      return (
        <svg
          className="h-4 w-4 text-rose-300"
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm.75-11.5a.75.75 0 0 0-1.5 0v4a.75.75 0 0 0 1.5 0v-4Zm0 6.5a.75.75 0 1 0-1.5 0 .75.75 0 0 0 1.5 0Z"
            clipRule="evenodd"
          />
        </svg>
      );
    }
    return (
      <svg
        className="h-4 w-4 text-slate-200"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
      </svg>
    );
  }, [state]);

  return (
    <Button
      onClick={doCopy}
      small
      variant="ghost"
      icon={icon}
      title="In Zwischenablage kopieren"
      className="hover:text-white"
    >
      {state === "ok" ? "Kopiert" : state === "err" ? "Fehler" : label}
    </Button>
  );
}
