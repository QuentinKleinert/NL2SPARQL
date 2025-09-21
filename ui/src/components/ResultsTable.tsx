import type { SPARQLSelectJSON } from "../types";

export default function ResultsTable({
  data,
}: {
  data: SPARQLSelectJSON | null;
}) {
  if (!data) return null;
  const vars = data.head?.vars ?? [];
  const rows = data.results?.bindings ?? [];

  if (!vars.length)
    return <div className="text-slate-400 text-sm">Keine Variablen.</div>;

  return (
    <div className="overflow-auto border border-slate-700 rounded-lg">
      <table className="min-w-[640px] w-full text-sm">
        <thead className="bg-slate-800">
          <tr>
            {vars.map((v) => (
              <th key={v} className="text-left px-3 py-2 font-semibold">
                {v}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className={i % 2 ? "bg-slate-900" : "bg-slate-950"}>
              {vars.map((v) => (
                <td key={v} className="px-3 py-2">
                  {r[v]?.value ?? ""}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
