import type { SPARQLSelectJSON } from "../types";

export default function SparqlTable({ data }: { data: SPARQLSelectJSON }) {
  const cols = data.head?.vars ?? [];
  const rows = data.results?.bindings ?? [];

  if (!cols.length)
    return <div className="text-xs text-slate-400">Keine Spalten.</div>;
  if (!rows.length)
    return <div className="text-xs text-slate-400">Keine Treffer.</div>;

  return (
    <div className="overflow-auto max-h-72 rounded border border-slate-700">
      <table className="min-w-full text-xs">
        <thead className="bg-slate-800 sticky top-0">
          <tr>
            {cols.map((c) => (
              <th
                key={c}
                className="text-left px-2 py-1 font-medium border-b border-slate-700"
              >
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-slate-900">
          {rows.map((r, i) => (
            <tr key={i} className="odd:bg-slate-900 even:bg-slate-900/60">
              {cols.map((c) => (
                <td
                  key={c}
                  className="px-2 py-1 align-top border-b border-slate-800"
                >
                  {r[c]?.value ?? "—"}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
