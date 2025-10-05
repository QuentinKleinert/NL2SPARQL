import Button from "./Button";

interface TopBarProps {
  backendBase: string;
  onChangeBase: (value: string) => void;
  onPing: () => Promise<void> | void;
  pingOK: boolean;
  busy?: boolean;
  apiToken: string;
  onChangeToken: (value: string) => void;
}

export default function TopBar({
  backendBase,
  onChangeBase,
  onPing,
  pingOK,
  busy,
  apiToken,
  onChangeToken,
}: TopBarProps) {
  const pingIndicator = pingOK ? "bg-emerald-500" : "bg-rose-500";

  return (
    <header className="border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 py-10 lg:flex-row lg:items-start">
        <div className="flex-1 space-y-4">
          <p className="text-xs uppercase tracking-[0.45em] text-sky-500">NL → SPARQL Studio</p>
          <h1 className="text-4xl font-semibold tracking-tight text-slate-900 md:text-5xl">
            Pfarrerdaten Cockpit
          </h1>
          <p className="max-w-2xl text-base leading-relaxed text-slate-600">
            Übersetze natürliche Sprache in abgesicherte SPARQL-Updates. Preview-Token, Explainability,
            Undo und Logging stellen sicher, dass Änderungen nachvollziehbar und DSGVO-konform bleiben.
          </p>
          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
            <span className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-4 py-1 uppercase tracking-[0.3em] text-sky-600">
              Sicher · Rückverfolgbar · Erklärbar
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-1 uppercase tracking-[0.3em] text-emerald-600">
              Undo & Logging aktiv
            </span>
          </div>
        </div>

        <aside className="w-full max-w-sm space-y-4 rounded-2xl border border-slate-200 bg-slate-50 px-6 py-6 shadow-sm">
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Backend Konfiguration</p>
            <p className="text-sm leading-relaxed text-slate-600">
              Für lokale Tests kannst du Ziel und API-Token anpassen. In der Produktion werden sie aus der `.env`
              übernommen.
            </p>
          </div>
          <label className="space-y-2 text-xs font-semibold text-slate-600">
            <span>Base URL</span>
            <input
              value={backendBase}
              onChange={(e) => onChangeBase(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 shadow-inner focus:border-sky-400 focus:outline-none"
              placeholder="http://127.0.0.1:8000"
            />
          </label>

          <label className="space-y-2 text-xs font-semibold text-slate-600">
            <span>API Token (`x-api-key`)</span>
            <input
              value={apiToken}
              onChange={(e) => onChangeToken(e.target.value.trim())}
              type="password"
              placeholder="dev-token"
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 shadow-inner focus:border-sky-400 focus:outline-none"
            />
          </label>

          <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs text-slate-600">
            <span className="inline-flex items-center gap-2">
              <span className={`inline-flex h-3.5 w-3.5 rounded-full border border-white/70 ${pingIndicator}`} />
              {pingOK ? "Backend erreichbar" : "Unbekannt"}
            </span>
            <Button
              onClick={onPing}
              loading={busy}
              variant="primary"
              small
              icon={
                <svg
                  className="h-4 w-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <path d="M2 12h4" />
                  <path d="M2 6h6" />
                  <path d="M2 18h6" />
                  <path d="M9 6h13" />
                  <path d="M13 12h9" />
                  <path d="M9 18h13" />
                </svg>
              }
            >
              Ping
            </Button>
          </div>

          <p className="text-[11px] leading-relaxed text-slate-500">
            Hinweis: In der Dev-UI speichert ein Wechsel die Werte im localStorage. In Production werden sie buildzeitlich
            gesetzt.
          </p>
        </aside>
      </div>
    </header>
  );
}
