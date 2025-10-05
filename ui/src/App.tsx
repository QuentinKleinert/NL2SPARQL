import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  getApiToken,
  setApiToken,
  fetchKpsSample,
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
import TopBar from "./components/TopBar";
import SectionCard from "./components/SectionCard";
import AlertBanner from "./components/AlertBanner";
import TokenBadge from "./components/TokenBadge";
import LogsPanel from "./components/LogsPanel";
import PerfPanel from "./components/PerfPanel";
import Button from "./components/Button";
import SparqlTable from "./components/SparqlTable";
import CopyButton from "./components/CopyButton";

const DEFAULT_NL =
  'Füge einen neuen Pfarrer mit Vorname "Max" und Nachname "Mustermann" hinzu.';

const TEMPLATES = [
  {
    label: "SELECT – Pfarrer:innen mit Namen",
    kind: "SELECT" as const,
    text: [
      "PREFIX voc:<http://meta-pfarrerbuch.evangelische-archive.de/vocabulary#>",
      "SELECT ?person ?vor ?nach WHERE {",
      "  ?person a voc:Pfarrer-in ;",
      "          voc:vorname ?vor ;",
      "          voc:nachname ?nach .",
      "} LIMIT 12",
    ].join("\n"),
  },
  {
    label: "INSERT – Beispielpfarrer",
    kind: "INSERT" as const,
    text: [
      "PREFIX voc:<http://meta-pfarrerbuch.evangelische-archive.de/vocabulary#>",
      "INSERT DATA { GRAPH <urn:nl2sparql:changes> {",
      "  <urn:example:person:NEW> a voc:Pfarrer-in ;",
      '      voc:vorname "Anna" ;',
      '      voc:nachname "Muster" .',
      "} }",
    ].join("\n"),
  },
  {
    label: "NL – Füge Pfarrer hinzu",
    kind: "NL" as const,
    text: DEFAULT_NL,
  },
];

const KPS_SAMPLE_QUERY = [
  "PREFIX voc:<http://meta-pfarrerbuch.evangelische-archive.de/vocabulary#>",
  "PREFIX rdfs:<http://www.w3.org/2000/01/rdf-schema#>",
  "SELECT ?person ?label WHERE {",
  "  GRAPH <http://meta-pfarrerbuch.evangelische-archive.de/data/kps/> {",
  "    ?person a voc:Pfarrer-in ;",
  "            rdfs:label ?label .",
  "  }",
  "}",
  "LIMIT 10",
].join("\n");

const ICONS = {
  generate: (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 2.5 14.4 7h5.6l-4.5 3.3 1.7 5.7L12 13.9 6.8 16l1.7-5.7L4 7h5.6L12 2.5Z" />
    </svg>
  ),
  validate: (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 2 4.5 6v6c0 5.1 3.8 9.9 7.5 10.9 3.7-1 7.5-5.8 7.5-10.9V6L12 2Zm3.9 7.4-4.5 4.6a1 1 0 0 1-1.4 0l-2-2.1a1 1 0 0 1 1.4-1.4l1.3 1.4 3.8-3.9a1 1 0 1 1 1.4 1.4Z" />
    </svg>
  ),
  explain: (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M6 4c-1.1 0-2 .9-2 2v13a1 1 0 0 0 1.5.86L9 18.1l3.5 1.76a1 1 0 0 0 .9 0L16 18.1l3.5 1.76a1 1 0 0 0 1.5-.86V6c0-1.1-.9-2-2-2H6Z" opacity=".35" />
      <path d="M8 7h8a1 1 0 1 1 0 2H8a1 1 0 1 1 0-2Zm0 4h5a1 1 0 1 1 0 2H8a1 1 0 0 1 0-2Z" />
    </svg>
  ),
  preview: (
    <svg
      className="h-4 w-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" />
      <circle cx="12" cy="12" r="2.5" />
    </svg>
  ),
  execute: (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="m12 2 3 6.8 6.5.5-5 4.2 1.7 6.5L12 16.9 5.8 20l1.7-6.5-5-4.2 6.5-.5L12 2Z" />
    </svg>
  ),
  select: (
    <svg
      className="h-4 w-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M3 9.5h18" />
      <path d="M8.5 9.5v10.5" opacity=".6" />
      <path d="M15.5 9.5v10.5" opacity=".6" />
    </svg>
  ),
  undo: (
    <svg
      className="h-3.5 w-3.5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <polyline points="3 7 3 13 9 13" />
      <path d="M3 13a9 9 0 1 0 2.13-8.36" />
    </svg>
  ),
};

const MESSAGE_TITLE: Record<"success" | "error" | "info", string> = {
  success: "Aktion erfolgreich",
  error: "Fehler",
  info: "Hinweis",
};

export default function App() {
  const [base, setBase] = useState<string>(getBackendBase());
  const [apiToken, setApiTokenState] = useState<string>(getApiToken());
  const [pingOK, setPingOK] = useState<boolean>(false);
  const [pingBusy, setPingBusy] = useState<boolean>(false);

  const [nl, setNl] = useState<string>(DEFAULT_NL);
  const [generated, setGenerated] = useState<string>("");
  const [editor, setEditor] = useState<string>(
    "PREFIX voc:<http://meta-pfarrerbuch.evangelische-archive.de/vocabulary#>\n# SELECT ... / INSERT DATA ..."
  );

  const [confirmToken, setConfirmToken] = useState<string | null>(null);
  const [tokenExpiresAt, setTokenExpiresAt] = useState<number | null>(null);

  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [explanation, setExplanation] = useState<ExplainResult | null>(null);
  const [selectRes, setSelectRes] = useState<SPARQLSelectJSON | null>(null);

  const [terms, setTerms] = useState<OntologyTerms | null>(null);
  const [logs, setLogs] = useState<LogsRecent["items"]>([]);
  const [logLimit, setLogLimit] = useState<number>(20);

  const [perf, setPerf] = useState<PerfMetrics | null>(null);
  const [perfWindow, setPerfWindow] = useState<number>(60);
  const [perfBusy, setPerfBusy] = useState<boolean>(false);

  const tokenExpired = tokenExpiresAt != null && Date.now() > tokenExpiresAt;
  const canExecute = !!confirmToken && tokenExpiresAt != null && !tokenExpired;

  const [message, setMessage] = useState<{
    text: string;
    kind: "success" | "error" | "info";
  } | null>(null);

  const hideTimer = useRef<number | null>(null);
  const show = useCallback(
    (text: string, kind: "success" | "error" | "info" = "info") => {
      setMessage({ text, kind });
      if (hideTimer.current) window.clearTimeout(hideTimer.current);
      hideTimer.current = window.setTimeout(() => setMessage(null), 3200);
    },
    []
  );
  useEffect(() => () => {
    if (hideTimer.current) window.clearTimeout(hideTimer.current);
  }, []);

  useEffect(() => {
    if (!apiToken) {
      show("Bitte API-Token setzen (x-api-key).", "info");
    }
  }, [apiToken, show]);

  const loadPerf = useCallback(async () => {
    try {
      setPerfBusy(true);
      setPerf(await getPerf(perfWindow));
    } catch {
      setPerf(null);
    } finally {
      setPerfBusy(false);
    }
  }, [perfWindow]);

  const refreshLogs = useCallback(async () => {
    try {
      const response = await recentLogs(logLimit);
      setLogs(response.items);
    } catch {
      setLogs([]);
    }
  }, [logLimit]);

  useEffect(() => {
    (async () => {
      try {
        const ping = await health();
        setPingOK(ping.ok);
      } catch {
        setPingOK(false);
      }
      try {
        setTerms(await getTerms());
      } catch {
        setTerms(null);
      }
      await refreshLogs();
      await loadPerf();
    })();
  }, [base, apiToken, refreshLogs, loadPerf]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      loadPerf();
      refreshLogs();
    }, 15000);
    return () => window.clearInterval(interval);
  }, [loadPerf, refreshLogs, apiToken]);

  const onChangeBase = (value: string) => {
    setBase(value);
    setBackendBase(value);
  };

  const onChangeToken = (value: string) => {
    setApiTokenState(value);
    setApiToken(value);
  };

  const onPing = useCallback(async () => {
    try {
      setPingBusy(true);
      const result = await health();
      setPingOK(result.ok);
      show("Backend erreichbar.", "success");
    } catch (e) {
      setPingOK(false);
      const msg = e instanceof Error ? e.message : String(e);
      show(`Ping fehlgeschlagen: ${msg}`, "error");
    } finally {
      setPingBusy(false);
    }
  }, [show]);

  const [loadingGen, setLoadingGen] = useState(false);
  const [loadingVal, setLoadingVal] = useState(false);
  const [loadingExp, setLoadingExp] = useState(false);
  const [loadingPrev, setLoadingPrev] = useState(false);
  const [loadingExec, setLoadingExec] = useState(false);
  const [loadingSel, setLoadingSel] = useState(false);
  const [loadingSample, setLoadingSample] = useState(false);

  const onGenerate = useCallback(async () => {
    try {
      setLoadingGen(true);
      const r = await generateNL(nl);
      setGenerated(r.sparql);
      setEditor(r.sparql);
      setValidation(r.validation);
      setExplanation(r.explain);
      setConfirmToken(r.confirm_token);
      setTokenExpiresAt(Date.now() + r.ttl_seconds * 1000);
      setSelectRes(null);
      show(`Generate ok (${r.model}), Token bereit.`, "success");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      show(`Generate-Fehler: ${msg}`, "error");
    } finally {
      setLoadingGen(false);
    }
  }, [nl, show]);

  const onValidate = useCallback(async () => {
    try {
      setLoadingVal(true);
      const v = await validateQuery(editor);
      setValidation(v);
      show("Validate ok", "success");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      show(`Validate-Fehler: ${msg}`, "error");
    } finally {
      setLoadingVal(false);
    }
  }, [editor, show]);

  const onExplain = useCallback(async () => {
    try {
      setLoadingExp(true);
      const ex = await explainQuery(editor);
      setExplanation(ex);
      show("Explain ok", "success");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      show(`Explain-Fehler: ${msg}`, "error");
    } finally {
      setLoadingExp(false);
    }
  }, [editor, show]);

  const onPreview = useCallback(async () => {
    try {
      setLoadingPrev(true);
      const r = await previewQuery(editor);
      setValidation(r.validation);
      setExplanation(r.explain);
      setConfirmToken(r.confirm_token);
      setTokenExpiresAt(Date.now() + r.ttl_seconds * 1000);
      show("Preview ok – Token bereit.", "success");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      show(`Preview-Fehler: ${msg}`, "error");
    } finally {
      setLoadingPrev(false);
    }
  }, [editor, show]);

  const onExecute = useCallback(async () => {
    if (!confirmToken || !tokenExpiresAt || Date.now() > tokenExpiresAt) {
      show("Kein gültiger Token. Bitte zuerst Preview oder Generate.", "error");
      return;
    }
    if (!window.confirm(`Diese Änderung jetzt ausführen?\n\nToken verfällt in ${tokenLeft}s.`)) {
      return;
    }
    try {
      setLoadingExec(true);
      const r = await executeToken(confirmToken);
      show(r.message || "Execute ok", "success");
      setConfirmToken(null);
      setTokenExpiresAt(null);
      await refreshLogs();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      show(`Execute-Fehler: ${msg}`, "error");
    } finally {
      setLoadingExec(false);
    }
  }, [confirmToken, tokenExpiresAt, refreshLogs, show]);

  const onRunSelect = useCallback(async () => {
    const sparqlText = editor;
    const looksLikeSelect = /^\s*(PREFIX\s+[^\n]+\n)*\s*(SELECT|ASK)\b/i.test(
      sparqlText
    );
    if (!looksLikeSelect) {
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
    } catch (e) {
      const ax = e as AxiosError<{ detail?: string; message?: string }>;
      const detail =
        ax.response?.data?.detail ?? ax.response?.data?.message ?? ax.message;
      setSelectRes(null);
      show(`SELECT-Fehler: ${detail}`, "error");
    } finally {
      setLoadingSel(false);
    }
  }, [editor, show]);

  const onRunKpsSample = useCallback(async () => {
    try {
      setLoadingSample(true);
      setEditor(KPS_SAMPLE_QUERY);
      setConfirmToken(null);
      setTokenExpiresAt(null);
      const data = await fetchKpsSample();
      setSelectRes(data);
      show("KPS-Beispiel geladen (10 Pfarrer:innen).", "success");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      show(`KPS-Beispiel fehlgeschlagen: ${msg}`, "error");
    } finally {
      setLoadingSample(false);
    }
  }, [show]);

  const onUndoLog = useCallback(
    async (record: LogRecord) => {
      const canUndo = record.status?.toLowerCase() === "applied" && !!record.undo_sparql;
      if (!canUndo) {
        show("Für diesen Eintrag gibt es kein automatisches Undo.", "info");
        return;
      }
      if (!window.confirm("Diese Änderung wirklich rückgängig machen?")) return;
      try {
        await undoChange({ log_record: record });
        show("Undo ausgeführt.", "success");
        await refreshLogs();
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        show(`Undo-Fehler: ${msg}`, "error");
      }
    },
    [refreshLogs, show]
  );

  const [now, setNow] = useState<number>(Date.now());
  useEffect(() => {
    if (!tokenExpiresAt) return;
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [tokenExpiresAt]);

  const tokenLeft = useMemo(() => {
    if (!tokenExpiresAt) return 0;
    return Math.max(0, Math.floor((tokenExpiresAt - now) / 1000));
  }, [tokenExpiresAt, now]);

  const selectHead = selectRes?.head?.vars ?? [];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <TopBar
        backendBase={base}
        onChangeBase={onChangeBase}
        onPing={onPing}
        pingOK={pingOK}
        busy={pingBusy}
        apiToken={apiToken}
        onChangeToken={onChangeToken}
      />

      <main className="mx-auto flex w-full max-w-6xl flex-col gap-12 px-6 pb-24 pt-12 md:px-8">
        {message && (
          <AlertBanner kind={message.kind} title={MESSAGE_TITLE[message.kind]}>
            {message.text}
          </AlertBanner>
        )}

        <SectionCard
          tone="accent"
          eyebrow="Schritt 1"
          title="Natürlichsprachliche Eingabe"
          description="Formuliere dein Anliegen in Alltagssprache und lass das LLM eine SPARQL-Update- oder SELECT-Query erzeugen."
          actions={
            <div className="flex items-center gap-3 text-xs text-slate-200/80">
              <span className="hidden sm:inline uppercase tracking-[0.26em]">Vorlage</span>
              <select
                className="rounded-xl border border-white/20 bg-white/10 px-3 py-1.5 text-sm text-slate-100 shadow-inner shadow-black/30 backdrop-blur"
                defaultValue=""
                onChange={(e) => {
                  const idx = Number(e.target.value);
                  if (Number.isNaN(idx)) return;
                  const tpl = TEMPLATES[idx];
                  if (!tpl) return;
                  if (tpl.kind === "NL") {
                    setNl(tpl.text);
                  } else {
                    setEditor(tpl.text);
                    setConfirmToken(null);
                    setTokenExpiresAt(null);
                  }
                  e.currentTarget.selectedIndex = 0;
                }}
              >
                <option value="" disabled>
                  Vorlage wählen …
                </option>
                {TEMPLATES.map((tpl, idx) => (
                  <option key={tpl.label} value={idx}>
                    {tpl.label}
                  </option>
                ))}
              </select>
            </div>
          }
        >
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
            <div className="space-y-4">
              <textarea
                value={nl}
                onChange={(e) => setNl(e.target.value)}
                className="h-36 w-full rounded-2xl border border-slate-800/50 bg-slate-950/60 p-4 font-mono text-sm text-slate-100 shadow-inner shadow-black/40 focus:border-brand-400 focus:outline-none"
                placeholder='z.B. "Füge einen neuen Pfarrer mit Vorname Max und Nachname Mustermann hinzu."'
              />
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  onClick={onGenerate}
                  loading={loadingGen}
                  variant="primary"
                  icon={ICONS.generate}
                >
                  NL → SPARQL generieren
                </Button>
                <p className="text-xs text-slate-400">
                  Tipp: Für Updates immer zuerst „Preview“, dann „Execute“.
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <header className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-slate-200">
                  Letzte Generierung
                </h3>
                <CopyButton getText={() => generated} />
              </header>
              <pre className="h-44 w-full overflow-auto rounded-2xl border border-slate-800/50 bg-slate-950/60 p-4 text-[11px] leading-relaxed text-slate-200">
                {generated || "Noch keine Query generiert."}
              </pre>
            </div>
          </div>
        </SectionCard>

        <SectionCard
          tone="glass"
          eyebrow="Schritt 2"
          title="SPARQL Composer"
          description="Passe die Query im Editor an, prüfe sie gegen die Ontologie und führe Updates nur nach erteilter Bestätigung aus."
          actions={
            canExecute && confirmToken && tokenExpiresAt ? (
              <TokenBadge secondsLeft={tokenLeft} />
            ) : null
          }
        >
          <div className="space-y-4">
            <div className="space-y-3">
              <header className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-medium text-slate-200">Editor</h3>
                <CopyButton getText={() => editor} />
              </header>
              <textarea
                value={editor}
                onChange={(e) => {
                  setEditor(e.target.value);
                  setConfirmToken(null);
                  setTokenExpiresAt(null);
                }}
                className="min-h-[320px] w-full rounded-2xl border border-slate-800/50 bg-slate-950/60 p-4 font-mono text-xs leading-relaxed text-slate-100 shadow-inner shadow-black/40 focus:border-brand-400 focus:outline-none"
                placeholder="PREFIX voc:<http://meta-...>\nSELECT ... / INSERT DATA ..."
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <Button onClick={onValidate} loading={loadingVal} icon={ICONS.validate}>
                Validate
              </Button>
              <Button onClick={onExplain} loading={loadingExp} icon={ICONS.explain}>
                Explain
              </Button>
              <Button
                onClick={onPreview}
                loading={loadingPrev}
                variant="primary"
                icon={ICONS.preview}
              >
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
                icon={ICONS.execute}
              >
                Execute
              </Button>
            <Button onClick={onRunSelect} loading={loadingSel} icon={ICONS.select}>
              Run SELECT
            </Button>
            <Button onClick={onRunKpsSample} loading={loadingSample}>
              KPS Beispiel
            </Button>
            </div>
          </div>
        </SectionCard>

        <SectionCard
          tone="neutral"
          eyebrow="Analyse"
          title="Auswertung"
          description="Validierung, Explainability und Resultate helfen beim sicheren Arbeiten mit der Pfarrerdatenbank."
        >
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="rounded-2xl border border-white/12 bg-slate-950/55 p-6 shadow-inner shadow-black/25">
              <h3 className="text-sm font-semibold text-slate-200">Validation</h3>
              <div className="mt-3 space-y-2 text-xs text-slate-200">
                {validation ? (
                  <>
                    <p
                      className={
                        validation.ok ? "text-emerald-300" : "text-amber-300"
                      }
                    >
                      ok: {String(validation.ok)}
                    </p>
                    {!!validation.errors.length && (
                      <div>
                        <p className="font-medium text-rose-300">Fehler</p>
                        <ul className="mt-1 list-disc space-y-1 pl-4">
                          {validation.errors.map((err) => (
                            <li key={err}>{err}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {!!validation.warnings.length && (
                      <div>
                        <p className="font-medium text-amber-300">Warnungen</p>
                        <ul className="mt-1 list-disc space-y-1 pl-4">
                          {validation.warnings.map((warn) => (
                            <li key={warn}>{warn}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    <div className="pt-2 text-[11px] text-slate-400">
                      Klassen: {validation.used_uris.classes.length} · Eigenschaften: {" "}
                      {validation.used_uris.properties.length}
                    </div>
                  </>
                ) : (
                  <p className="text-slate-400">Noch keine Validierung durchgeführt.</p>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-white/12 bg-slate-950/55 p-6 shadow-inner shadow-black/25">
              <h3 className="text-sm font-semibold text-slate-200">Explain</h3>
              <div className="mt-3 space-y-2 text-xs text-slate-200">
                {explanation ? (
                  <>
                    <p className="font-medium text-slate-100">{explanation.kind}</p>
                    <p className="text-slate-300">{explanation.summary}</p>
                    {!!explanation.predicates?.length && (
                      <div>
                        <p className="font-medium text-slate-200">Prädikate</p>
                        <ul className="mt-1 list-disc space-y-1 pl-4 text-slate-300">
                          {explanation.predicates.slice(0, 10).map((p) => (
                            <li key={p}>{p}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </>
                ) : (
                  <p className="text-slate-400">Noch keine Explain-Auswertung.</p>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-white/12 bg-slate-950/55 p-6 shadow-inner shadow-black/25">
              <h3 className="text-sm font-semibold text-slate-200">SELECT Ergebnis</h3>
              <div className="mt-3 text-xs text-slate-200">
                {selectRes ? (
                  <div className="space-y-3">
                    <SparqlTable data={selectRes} />
                    <div className="text-[11px] text-slate-400">
                      Spalten: {selectHead.join(", ") || "–"}
                    </div>
                  </div>
                ) : (
                  <p className="text-slate-400">Noch kein SELECT ausgeführt.</p>
                )}
              </div>
            </div>
          </div>
        </SectionCard>

        <SectionCard
          tone="glass"
          eyebrow="Revision"
          title="Aktivitätslog"
          description="Alle Änderungen werden pseudonymisiert gespeichert. Undo ist für INSERT/DELETE DATA verfügbar."
        >
          <LogsPanel
            items={logs}
            onUndo={onUndoLog}
            limit={logLimit}
            onChangeLimit={setLogLimit}
          />
        </SectionCard>

        <SectionCard
          tone="glass"
          eyebrow="Monitoring"
          title="Performance"
          description="Antwortzeiten von Backend und Fuseki im gewählten Zeitfenster."
          padding="compact"
        >
          <PerfPanel
            metrics={perf}
            minutes={perfWindow}
            onChangeWindow={setPerfWindow}
            onRefresh={loadPerf}
            loading={perfBusy}
          />
        </SectionCard>

        {terms && (
          <SectionCard
            tone="glass"
            eyebrow="Kontext"
            title="Ontologie-Überblick"
            description="Auszug der Klassen und Properties, die dem LLM zur Verfügung stehen."
          >
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-slate-200">Klassen</h3>
                <ul className="grid gap-1 text-xs text-slate-300">
                  {terms.classes.slice(0, 18).map((c) => (
                    <li key={c.uri} className="truncate">
                      <span className="text-slate-400">• </span>
                      {c.label ? `${c.label} — ` : ""}
                      <code className="text-[11px] text-slate-500">{c.uri}</code>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-slate-200">Eigenschaften</h3>
                <ul className="grid gap-1 text-xs text-slate-300">
                  {terms.properties.slice(0, 18).map((p) => (
                    <li key={p.uri} className="truncate">
                      <span className="text-slate-400">• </span>
                      {p.label ? `${p.label} — ` : ""}
                      <code className="text-[11px] text-slate-500">{p.uri}</code>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <p className="text-xs text-slate-500">
              Gesamt: {terms.classes.length} Klassen · {terms.properties.length} Eigenschaften
            </p>
          </SectionCard>
        )}
      </main>

      <footer className="relative z-10 mx-auto w-full max-w-7xl px-6 pb-10 pt-6 text-xs text-slate-500">
        <div className="flex flex-wrap items-center gap-2 border-t border-slate-800 pt-4">
          <span>© 2025 Quentin Kleinert – Bachelorarbeit</span>
          <span>·</span>
          <span>NL2SPARQL Interface</span>
        </div>
      </footer>
    </div>
  );
}
