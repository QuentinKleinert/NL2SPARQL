import axios from "axios";
import type { AxiosInstance } from "axios";
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
} from "../types";

const KEY = "nl2sparql_backend_base";
const fallback =
  import.meta.env.VITE_BACKEND_BASE_URL || "http://127.0.0.1:8000";

let baseURL = localStorage.getItem(KEY) || fallback;

export const setBackendBase = (url: string) => {
  baseURL = url.replace(/\/+$/, "");
  localStorage.setItem(KEY, baseURL);
};
export const getBackendBase = () => baseURL;

export const api = (): AxiosInstance =>
  axios.create({ baseURL, timeout: 20000 });

// ---- calls ----
export async function health(): Promise<HealthResponse> {
  const r = await api().get<HealthResponse>("/health");
  return r.data;
}
export async function getTerms(): Promise<OntologyTerms> {
  const r = await api().get<OntologyTerms>("/ontology/terms");
  return r.data;
}
export async function draft(
  text: string,
  intent?: string
): Promise<DraftResponse> {
  const r = await api().post<DraftResponse>("/nl2sparql/draft", {
    text,
    intent,
  });
  return r.data;
}
export async function validateQuery(
  sparqlText: string
): Promise<ValidationResult> {
  const r = await api().post<ValidationResult>("/nl2sparql/validate", {
    sparql: sparqlText,
  });
  return r.data;
}
export async function explainQuery(sparqlText: string): Promise<ExplainResult> {
  const r = await api().post<ExplainResult>("/nl2sparql/explain", {
    sparql: sparqlText,
  });
  return r.data;
}
export async function previewQuery(
  sparqlText: string
): Promise<PreviewResponse> {
  const r = await api().post<PreviewResponse>("/nl2sparql/preview", {
    sparql: sparqlText,
  });
  return r.data;
}
export async function executeToken(token: string): Promise<ExecuteResponse> {
  const r = await api().post<ExecuteResponse>("/nl2sparql/execute", {
    confirm_token: token,
  });
  return r.data;
}
export async function runSelect(
  sparqlText: string
): Promise<{ ok: boolean; results: SPARQLSelectJSON }> {
  const r = await api().post<{ ok: boolean; results: SPARQLSelectJSON }>(
    "/nl2sparql/select",
    { sparql: sparqlText }
  );
  return r.data;
}
export async function generateNL(
  text: string,
  intent?: string
): Promise<GenerateResponse> {
  const r = await api().post<GenerateResponse>("/nl2sparql/generate", {
    text,
    intent,
  });
  return r.data;
}
export async function recentLogs(limit = 10): Promise<LogsRecent> {
  const r = await api().get<LogsRecent>(`/logs/recent?limit=${limit}`);
  return r.data;
}

export async function undoChange(req: UndoRequest): Promise<UndoResponse> {
  const r = await api().post<UndoResponse>("/nl2sparql/undo", req);
  return r.data;
}
