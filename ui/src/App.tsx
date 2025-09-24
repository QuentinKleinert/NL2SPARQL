import { useEffect, useMemo, useState, useRef } from "react";
import type { AxiosError } from "axios";
import {
  getBackendBase,
  setBackendBase,
  health,
  getTerms,
  recentLogs,
  generateNL,
  validateQuery,
  explainQuery,
  previewQuery,
  executeToken,
  runSelect,
  undoChange,
  getPerf,
} from "./lib/api";
import type {
  OntologyTerms,
  LogsRecent,
  SPARQLSelectJSON,
  ValidationResult,
  ExplainResult,
  LogRecord,
  PerfMetrics,
} from "./types";
import Button from "./components/Button";
import SparqlTable from "./components/SparqlTable";
import CopyButton from "./components/CopyButton";

function Pill({ ok }: { ok: boolean }) {
  return (
    <span
      className={`inline-block w-2.5 h-2.5 rounded-full ${
        ok ? "bg-emerald-400" : "bg-slate-500"
      }`}
      title={ok ? "Backend erreichbar" : "Backend unbekannt"}
    />
  );
}

export default function App() {
  // Backend base
  const [base, setBase] = useState<string>(getBackendBase());
  const [pingOK, setPingOK] = useState<boolean>(false);

  // NL input / generated / editor
  const [nl, setNl] = useState<string>(
    'Füge einen neuen Pfarrer mit Vorname "Max" und Nachname "Mustermann" hinzu.'
  );
  const [generated, setGenerated] = useState<string>("");
  const [editor, setEditor] = useState<string>(
    "PREFIX voc:<http://meta-pfarrerbuch.evangelische-archive.de/vocabulary#>\n# SELECT ... / INSERT DATA ..."
  );

  // preview/execute
  const [confirmToken, setConfirmToken] = useState<string | null>(null);
  const [tokenExpiresAt, setTokenExpiresAt] = useState<number | null>(null);

  // results
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [explanation, setExplanation] = useState<ExplainResult | null>(null);
  const [selectRes, setSelectRes] = useState<SPARQLSelectJSON | null>(null);

  // terms & logs
  const [terms, setTerms] = useState<OntologyTerms | null>(null);
  const [logs, setLogs] = useState<LogsRecent["items"]>([]);

  const tokenExpired = tokenExpiresAt != null && Date.now() > tokenExpiresAt;

  const canExecute = !!confirmToken && tokenExpiresAt != null && !tokenExpired;

  // messages
  const [message, setMessage] = useState<{
    text: string;
    kind: "success" | "error" | "info";
  } | null>(null);

  const [perf, setPerf] = useState<PerfMetrics | null>(null);

  const templates = [
    {
      label: "SELECT: 10 Pfarrer:innen",
      kind: "SELECT",
      text:
        "PREFIX voc:<http://meta-pfarrerbuch.evangelische-archive.de/vocabulary#>\n" +
        "SELECT ?person ?vor ?nach WHERE {\n" +
        "  ?person a voc:Pfarrer-in ;\n" +
        "          voc:vorname ?vor ;\n" +
        "          voc:nachname ?nach .\n" +
        "} LIMIT 10\n",
    },
    {
      label: "INSERT-Beispiel (Anna Muster)",
      kind: "INSERT",
      text:
        "PREFIX voc:<http://meta-pfarrerbuch.evangelische-archive.de/vocabulary#>\n" +
        "INSERT DATA { GRAPH <urn:nl2sparql:changes> {\n" +
        "  <urn:example:person:NEW> a voc:Pfarrer-in ;\n" +
        '      voc:vorname "Anna" ;\n' +
        '      voc:nachname "Muster" .\n' +
        "} }\n",
    },
    {
      label: "NL: Füge Pfarrer …",
      kind: "NL",
      text: 'Füge einen neuen Pfarrer mit Vorname "Max" und Nachname "Mustermann" hinzu.',
    },
  ];

  // helper
  const hideTimer = useRef<number | null>(null);
  const show = (text: string, kind: "success" | "error" | "info" = "info") => {
    setMessage({ text, kind });
    if (hideTimer.current) window.clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => setMessage(null), 2500);
  };
  useEffect(
    () => () => {
      if (hideTimer.current) window.clearTimeout(hideTimer.current);
    },
    []
  );

  const [loadingGen, setLoadingGen] = useState(false);
  const [loadingVal, setLoadingVal] = useState(false);
  const [loadingExp, setLoadingExp] = useState(false);
  const [loadingPrev, setLoadingPrev] = useState(false);
  const [loadingExec, setLoadingExec] = useState(false);
  const [loadingSel, setLoadingSel] = useState(false);

  // initial load + polling (simple)
  useEffect(() => {
    (async () => {
      try {
        setPingOK((await health()).ok);
      } catch {
        setPingOK(false);
      }
      try {
        setTerms(await getTerms());
      } catch {}
      try {
        setLogs((await recentLogs(10)).items);
      } catch {}
    })();
    const t = setInterval(async () => {
      try {
        setLogs((await recentLogs(10)).items);
      } catch {}
    }, 5000);
    return () => clearInterval(t);
  }, [base]);

  useEffect(() => {
    (async () => {
      try {
        setPerf(await getPerf(60));
      } catch {}
    })();
    const perfTimer = setInterval(async () => {
      try {
        setPerf(await getPerf(60));
      } catch {}
    }, 10000);
    return () => clearInterval(perfTimer);
  }, [base]);

  // base url input change
  const onChangeBase = (s: string) => {
    setBase(s);
    setBackendBase(s);
  };

  // Generate → sets generated + editor, stores token (ready to execute)
  const onGenerate = async () => {
    try {
      setLoadingGen(true);
      const r = await generateNL(nl);
      setGenerated(r.sparql);
      setEditor(r.sparql);
      setValidation(r.validation);
      setExplanation(r.explain);
      setConfirmToken(r.confirm_token);
      setTokenExpiresAt(Date.now() + r.ttl_seconds * 1000);
      show(`Generate ok (${r.model}), Token bereit.`, "success");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      show(`Generate-Fehler: ${msg}`, "error");
    } finally {
      setLoadingGen(false);
    }
  };

  // Validate
  const onValidate = async () => {
    try {
      setLoadingVal(true);
      const v = await validateQuery(editor); // <-- wichtig: Editor-Text validieren
      setValidation(v);
      show("Validate ok", "success");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      show(`Validate-Fehler: ${msg}`, "error");
    } finally {
      setLoadingVal(false);
    }
  };

  // Explain
  const onExplain = async () => {
    try {
      setLoadingExp(true);
      const ex = await explainQuery(editor);
      setExplanation(ex);
      show("Explain ok", "success");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      show(`Explain-Fehler: ${msg}`, "error");
    } finally {
      setLoadingExp(false);
    }
  };

  // Preview → new token
  const onPreview = async () => {
    try {
      setLoadingPrev(true);
      const r = await previewQuery(editor);
      setValidation(r.validation);
      setExplanation(r.explain);
      setConfirmToken(r.confirm_token);
      setTokenExpiresAt(Date.now() + r.ttl_seconds * 1000);
      show("Preview ok – Token bereit zum Ausführen", "success");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      show(`Preview-Fehler: ${msg}`, "error");
    } finally {
      setLoadingPrev(false);
    }
  };

  // Execute (uses last token)
  const onExecute = async () => {
    try {
      setLoadingExec(true);
      if (!confirmToken || !tokenExpiresAt || Date.now() > tokenExpiresAt) {
        show(
          "Kein gültiger Token. Bitte zuerst Preview oder Generate.",
          "error"
        );
        return;
      }
      if (
        !confirm(
          `Diese Änderung jetzt ausführen?\n\nHinweis: Der Token verfällt in ${tokenLeft}s.`
        )
      ) {
        return;
      }

      const r = await executeToken(confirmToken);
      show(r.message || "Execute ok", "success");
      setConfirmToken(null);
      setTokenExpiresAt(null);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      show(`Execute-Fehler: ${msg}`, "error");
    } finally {
      setLoadingExec(false);
    }
  };

  // Run SELECT
  const onRunSelect = async () => {
    const sparqlText = editor;
    const U = sparqlText.trim().toUpperCase();
    if (!(U.startsWith("SELECT") || U.startsWith("ASK"))) {
      show(
        'Bitte einen gültigen SELECT/ASK ins Editor-Feld schreiben (Updates mit "Execute" ausführen).',
        "info"
      );
      return;
    }

    try {
      setLoadingSel(true);
      const { ok, results } = await runSelect(sparqlText);
      if (ok) {
        setSelectRes(results);
        show("SELECT ausgeführt.", "success");
      } else {
        setSelectRes(null);
        show("SELECT fehlgeschlagen (ok=false).", "error");
      }
    } catch (e: unknown) {
      const ax = e as AxiosError<{ detail?: string; message?: string }>;
      const detail =
        ax.response?.data?.detail ?? ax.response?.data?.message ?? ax.message;
      setSelectRes(null);
      show(`SELECT-Fehler: ${detail}`, "error");
    } finally {
      setLoadingSel(false);
    }
  };

  // live countdown for token
  const [now, setNow] = useState<number>(Date.now());
  useEffect(() => {
    if (!tokenExpiresAt) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [tokenExpiresAt]);

  const tokenLeft = useMemo(() => {
    if (!tokenExpiresAt) return 0;
    return Math.max(0, Math.floor((tokenExpiresAt - now) / 1000));
  }, [tokenExpiresAt, now]);

  const onUndoLog = async (rec: LogRecord) => {
    const canUndo =
      rec.status?.toLowerCase() === "applied" && !!rec.undo_sparql;

    if (!canUndo) {
      show("Für diesen Eintrag gibt es kein automatisches Undo.", "info");
      return;
    }
    if (!confirm("Diese Änderung wirklich rückgängig machen?")) return;

    try {
      await undoChange({ log_record: rec });
      show("Undo ausgeführt.", "success");
      // Logs sofort aktualisieren (zusätzlich zum Polling)
      setLogs((await recentLogs(10)).items);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      show(`Undo-Fehler: ${msg}`, "error");
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100">
      {/* Top Bar */}
      <div className="sticky top-0 z-10 bg-slate-900/80 backdrop-blur border-b border-slate-800">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
          <h1 className="text-2xl font-bold tracking-wide">NL2SPARQL UI</h1>
          <div className="ml-auto flex items-center gap-2">
            <span className="text-sm">Backend:</span>
            <input
              value={base}
              onChange={(e) => onChangeBase(e.target.value)}
              className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-sm w-[200px]"
            />
            <button
              onClick={async () => {
                try {
                  setPingOK((await health()).ok);
                  show("Ping ok", "success");
                } catch {
                  setPingOK(false);
                  show("Ping fehlgeschlagen", "error");
                }
              }}
              className="px-3 py-1 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-sm"
            >
              Ping{" "}
              <span className="ml-2">
                <Pill ok={pingOK} />
              </span>
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6 space-y-8">
        {/* NL Input */}
        <section>
          <h2 className="text-lg font-semibold mb-2">
            Natürlichsprachliche Anfrage
          </h2>
          <textarea
            value={nl}
            onChange={(e) => setNl(e.target.value)}
            className="w-full h-20 md:h-24 bg-slate-800 border border-slate-700 rounded p-2 font-mono text-sm"
            placeholder='z.B. "Füge einen neuen Pfarrer mit Vorname Max und Nachname Mustermann hinzu."'
          />
          <div className="mt-2">
            <Button onClick={onGenerate} loading={loadingGen} variant="primary">
              Generate
            </Button>
          </div>
        </section>

        <p className="mt-1 text-xs text-slate-400">
          Tipp: „Generate“ erzeugt SPARQL aus natürlicher Sprache. Für Updates
          immer erst „Preview“ (Token), dann „Execute“. SELECTs bitte mit „Run
          SELECT“ ausführen.
        </p>

        {/* Generated */}
        <section>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-semibold">Generated SPARQL</h2>
            <CopyButton getText={() => generated} />
          </div>
          <pre className="w-full h-48 overflow-auto bg-slate-800 border border-slate-700 rounded p-3 text-xs whitespace-pre-wrap">
            {generated || "–"}
          </pre>
        </section>

        {/* Editor */}
        <section>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-semibold">SPARQL Editor</h2>
            <CopyButton getText={() => editor} />
          </div>
          <textarea
            value={editor}
            onChange={(e) => {
              setEditor(e.target.value);
              // Editor geändert → Token ungültig machen (bewusste UX)
              setConfirmToken(null);
              setTokenExpiresAt(null);
            }}
            className="min-h-[260px] md:min-h-[320px] w-full bg-slate-800 border border-slate-700 rounded p-3 font-mono text-xs"
            placeholder="PREFIX voc:<http://meta-...>\nSELECT ... / INSERT DATA ..."
          />
          <div className="mt-3 flex flex-wrap gap-2">
            <Button onClick={onValidate} loading={loadingVal}>
              Validate
            </Button>
            <Button onClick={onExplain} loading={loadingExp}>
              Explain
            </Button>
            <Button onClick={onPreview} loading={loadingPrev} variant="primary">
              Preview
            </Button>
            <Button
              onClick={onExecute}
              loading={loadingExec}
              variant="danger"
              disabled={!canExecute}
              title={
                !confirmToken
                  ? "Bitte erst Preview/Generate"
                  : tokenExpiresAt == null
                    ? "Kein Token"
                    : tokenExpired
                      ? "Token abgelaufen"
                      : ""
              }
            >
              Execute
            </Button>
            <Button onClick={onRunSelect} loading={loadingSel}>
              Run SELECT
            </Button>

            <select
              className="px-2 py-1 border border-slate-700 bg-slate-800 rounded text-sm"
              defaultValue=""
              onChange={(e) => {
                const idx = Number(e.target.value);
                if (Number.isNaN(idx)) return;
                const t = templates[idx];
                if (!t) return;
                if (t.kind === "NL") setNl(t.text);
                else {
                  setEditor(t.text);
                  setConfirmToken(null);
                  setTokenExpiresAt(null);
                }
                e.currentTarget.selectedIndex = 0; // zurück auf Placeholder
              }}
              title="Schnellvorlagen für NL/Editor"
            >
              <option value="" disabled>
                — Vorlage wählen —
              </option>
              {templates.map((t, i) => (
                <option key={i} value={i.toString()}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          {confirmToken && tokenExpiresAt && (
            <div className="mt-2 text-sm">
              <span className="px-2 py-0.5 rounded bg-emerald-900/40 text-emerald-200 border border-emerald-700">
                Token bereit — verfällt in {tokenLeft}s
              </span>
            </div>
          )}
        </section>

        {/* Ergebnisse */}
        <section>
          <h2 className="text-lg font-semibold mb-2">Ergebnis</h2>

          {message && (
            <div
              className={`mb-3 rounded px-3 py-2 text-sm ${
                message.kind === "success"
                  ? "bg-emerald-900/40 text-emerald-200 border border-emerald-700"
                  : message.kind === "error"
                    ? "bg-rose-900/40 text-rose-200 border border-rose-700"
                    : "bg-slate-800 text-slate-200 border border-slate-700"
              }`}
            >
              {message.text}
            </div>
          )}

          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <div className="rounded border border-slate-700">
                <div className="px-3 py-2 text-sm font-medium border-b border-slate-700 bg-slate-800">
                  Ontology (Auszug)
                </div>
                <div className="p-3 text-xs text-slate-300 space-y-1">
                  <div>Klassen: {terms?.classes.length ?? 0}</div>
                  <div>Properties: {terms?.properties.length ?? 0}</div>
                </div>
              </div>

              <details className="rounded border border-slate-700" open>
                <summary className="px-3 py-2 text-sm font-medium bg-slate-800 cursor-pointer">
                  Recent Logs (10)
                </summary>
                <div className="p-2 space-y-2">
                  {logs.map((x, i) => {
                    const canUndo =
                      x.status?.toLowerCase() === "applied" && !!x.undo_sparql;
                    return (
                      <div key={i} className="rounded border border-slate-800">
                        <div className="px-2 py-1.5 flex items-center justify-between text-[11px] bg-slate-900 border-b border-slate-800">
                          <div className="truncate">
                            {x.ts} — {x.status?.toUpperCase()}
                          </div>
                          <button
                            onClick={() => onUndoLog(x)}
                            disabled={!canUndo}
                            className={`px-2 py-0.5 rounded text-[11px] ${
                              canUndo
                                ? "bg-rose-600 hover:bg-rose-500 text-white"
                                : "bg-slate-700 text-slate-400 cursor-not-allowed"
                            }`}
                            title={
                              canUndo
                                ? "Änderung rückgängig machen"
                                : "Kein Undo verfügbar"
                            }
                          >
                            Undo
                          </button>
                        </div>
                        <pre className="text-[11px] p-2 overflow-auto max-h-40 whitespace-pre-wrap">
                          {`${x.sparql}
`}
                        </pre>
                      </div>
                    );
                  })}
                </div>
              </details>
            </div>

            <div className="space-y-3">
              <div className="rounded border border-slate-700">
                <div className="px-3 py-2 text-sm font-medium border-b border-slate-700 bg-slate-800">
                  Validation
                </div>
                <div className="p-3 text-xs whitespace-pre-wrap">
                  {validation ? JSON.stringify(validation, null, 2) : "—"}
                </div>
              </div>

              <div className="rounded border border-slate-700">
                <div className="px-3 py-2 text-sm font-medium border-b border-slate-700 bg-slate-800">
                  Explain
                </div>
                <div className="p-3 text-xs whitespace-pre-wrap">
                  {explanation ? JSON.stringify(explanation, null, 2) : "—"}
                </div>
              </div>

              <div className="rounded border border-slate-700">
                <div className="px-3 py-2 text-sm font-medium border-b border-slate-700 bg-slate-800">
                  SELECT Result
                </div>
                <div className="p-3 text-xs whitespace-pre-wrap">
                  {selectRes ? (
                    <SparqlTable data={selectRes} />
                  ) : (
                    "Noch kein SELECT ausgeführt."
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>
        <div className="rounded border border-slate-700">
          <div className="px-3 py-2 text-sm font-medium border-b border-slate-700 bg-slate-800">
            Performance (letzte {perf?.window_minutes ?? 60} min)
          </div>
          <div className="p-3 text-xs space-y-2">
            {perf ? (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded bg-slate-800 p-2 border border-slate-700">
                    <div className="font-medium">HTTP</div>
                    <div>n: {perf.http.n}</div>
                    <div>p50: {perf.http.p50_ms} ms</div>
                    <div>p95: {perf.http.p95_ms} ms</div>
                    <div>max: {perf.http.max_ms} ms</div>
                  </div>
                  <div className="rounded bg-slate-800 p-2 border border-slate-700">
                    <div className="font-medium">Fuseki SELECT</div>
                    <div>n: {perf.fuseki.select.n}</div>
                    <div>p50: {perf.fuseki.select.p50_ms} ms</div>
                    <div>p95: {perf.fuseki.select.p95_ms} ms</div>
                    <div>max: {perf.fuseki.select.max_ms} ms</div>
                  </div>
                  <div className="rounded bg-slate-800 p-2 border border-slate-700">
                    <div className="font-medium">Fuseki UPDATE</div>
                    <div>n: {perf.fuseki.update.n}</div>
                    <div>p50: {perf.fuseki.update.p50_ms} ms</div>
                    <div>p95: {perf.fuseki.update.p95_ms} ms</div>
                    <div>max: {perf.fuseki.update.max_ms} ms</div>
                  </div>
                </div>

                <details className="mt-2">
                  <summary className="cursor-pointer">
                    Top HTTP-Pfadaufrufe
                  </summary>
                  <ul className="mt-1 list-disc ml-5 space-y-0.5">
                    {perf.top_http_paths.map((x, i) => (
                      <li key={i}>
                        <code>{x.path}</code> — {x.count}
                      </li>
                    ))}
                  </ul>
                </details>
              </>
            ) : (
              "—"
            )}
          </div>
        </div>
      </div>
      <footer className="max-w-5xl mx-auto px-4 pb-6 text-xs text-slate-400">
        <div className="border-t border-slate-800 pt-3 flex flex-wrap items-center gap-2">
          <span>© 2025 Quentin Kleinert — Bachelorarbeit</span>
          <span className="hidden md:inline">·</span>
          <span>NL2SPARQL UI</span>
        </div>
      </footer>
    </div>
  );
}
