import { useState } from "react";

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
      setTimeout(() => setState("idle"), 1000);
    } catch {
      setState("err");
      setTimeout(() => setState("idle"), 1500);
    }
  };
  return (
    <button
      onClick={doCopy}
      className="px-2 py-1 text-xs rounded border border-slate-600 bg-slate-800 hover:bg-slate-700"
      title="In Zwischenablage kopieren"
    >
      {state === "ok" ? "Kopiert ✓" : state === "err" ? "Fehler" : label}
    </button>
  );
}
