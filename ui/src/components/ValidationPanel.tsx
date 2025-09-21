import type { ExplainResult, ValidationResult } from "../types";

export default function ValidationPanel({
  validation,
  explain,
}: {
  validation?: ValidationResult;
  explain?: ExplainResult;
}) {
  if (!validation && !explain) return null;

  return (
    <div className="space-y-2">
      {validation && (
        <div className="rounded-lg border border-slate-700 p-3">
          <div className="font-semibold mb-1">Validation</div>
          <div className="text-sm">
            <div
              className={validation.ok ? "text-emerald-400" : "text-amber-400"}
            >
              ok: {String(validation.ok)}
            </div>
            {!!validation.errors.length && (
              <ul className="text-red-400 list-disc ml-5">
                {validation.errors.map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            )}
            {!!validation.warnings.length && (
              <ul className="text-amber-400 list-disc ml-5">
                {validation.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {explain && (
        <div className="rounded-lg border border-slate-700 p-3">
          <div className="font-semibold mb-1">Explain</div>
          <div className="text-sm text-slate-200">
            <div>Kind: {explain.kind}</div>
            <div>Summary: {explain.summary}</div>
            {!!explain.predicates?.length && (
              <div className="mt-1">
                <div className="text-slate-400">Predicates:</div>
                <ul className="list-disc ml-5">
                  {explain.predicates.slice(0, 10).map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
