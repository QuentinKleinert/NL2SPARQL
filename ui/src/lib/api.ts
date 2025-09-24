// ui/src/lib/api.ts
import axios, { type AxiosInstance } from "axios";
import type {
  HealthResponse,
  OntologyTerms,
  DraftResponse,
  ValidationResult,
  ExplainResult,
  PreviewResponse,
  ExecuteResponse,
  SPARQLSelectJSON,
  GenerateResponse,
  LogsRecent,
  UndoRequest,
  UndoResponse,
  PerfMetrics,
} from "../types";

// Einheitlicher Key
const LS_KEY = "nl2sparql_backend_base";

// In Prod immer Proxy-Pfad / Env, in Dev fallback auf 127.0.0.1:8000
const DEFAULT_BASE =
  import.meta.env.VITE_BACKEND_BASE_URL ??
  (import.meta.env.PROD ? "/api" : "http://127.0.0.1:8000");

export const getBackendBase = (): string => {
  if (import.meta.env.PROD) return DEFAULT_BASE; // Prod: fest
  return localStorage.getItem(LS_KEY) ?? DEFAULT_BASE; // Dev: LS-Override
};

export const setBackendBase = (v: string) => {
  if (import.meta.env.PROD) return; // Prod: ignorieren
  localStorage.setItem(LS_KEY, v);
};

// Wichtig: JEDES MAL die aktuelle Base holen
export const api = (): AxiosInstance =>
  axios.create({ baseURL: getBackendBase(), timeout: 20000 });

// ---- calls ----
export async function health(): Promise<HealthResponse> {
  const r = await api().get<HealthResponse>("/health");
  return r.data;
}

export async function getTerms(): Promise<OntologyTerms> {
  const r = await api().get("/ontology/terms");
  return r.data;
}
export async function draft(
  text: string,
  intent?: string
): Promise<DraftResponse> {
  const r = await api().post("/nl2sparql/draft", { text, intent });
  return r.data;
}
export async function validateQuery(
  sparqlText: string
): Promise<ValidationResult> {
  const r = await api().post("/nl2sparql/validate", { sparql: sparqlText });
  return r.data;
}
export async function explainQuery(sparqlText: string): Promise<ExplainResult> {
  const r = await api().post("/nl2sparql/explain", { sparql: sparqlText });
  return r.data;
}
export async function previewQuery(
  sparqlText: string
): Promise<PreviewResponse> {
  const r = await api().post("/nl2sparql/preview", { sparql: sparqlText });
  return r.data;
}
export async function executeToken(token: string): Promise<ExecuteResponse> {
  const r = await api().post("/nl2sparql/execute", { confirm_token: token });
  return r.data;
}
export async function runSelect(
  sparqlText: string
): Promise<{ ok: boolean; results: SPARQLSelectJSON }> {
  const r = await api().post("/nl2sparql/select", { sparql: sparqlText });
  return r.data;
}
export async function generateNL(
  text: string,
  intent?: string
): Promise<GenerateResponse> {
  const r = await api().post("/nl2sparql/generate", { text, intent });
  return r.data;
}
export async function recentLogs(limit = 10): Promise<LogsRecent> {
  const r = await api().get(`/logs/recent?limit=${limit}`);
  return r.data;
}
export async function undoChange(req: UndoRequest): Promise<UndoResponse> {
  const r = await api().post("/nl2sparql/undo", req);
  return r.data;
}

export async function getPerf(minutes = 60): Promise<PerfMetrics> {
  const r = await api().get(`/metrics/perf?minutes=${minutes}`);
  return r.data;
}
