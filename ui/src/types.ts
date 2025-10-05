export interface HealthResponse {
  ok: boolean;
}

export interface OntologyTerm {
  uri: string;
  label?: string;
}
export interface OntologyTerms {
  classes: OntologyTerm[];
  properties: OntologyTerm[];
}

export interface DraftResponse {
  operation: string;
  sparql: string;
  explanation: string;
}

export interface ValidationResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
  used_uris: { classes: string[]; properties: string[] };
}

export interface ExplainResult {
  kind: string;
  summary: string;
  predicates: string[];
  lines: number;
}

export interface PreviewResponse {
  validation: ValidationResult;
  explain: ExplainResult;
  confirm_token: string;
  ttl_seconds: number;
}

export interface ExecuteResponse {
  ok: boolean;
  message: string;
  undo_sparql?: string | null;
}

export interface GenerateResponse {
  ok: boolean;
  model: string;
  sparql: string;
  validation: ValidationResult;
  explain: ExplainResult;
  confirm_token: string;
  ttl_seconds: number;
  attempts: number;
}

export interface SPARQLBinding {
  type: string;
  value: string;
  ["xml:lang"]?: string;
  datatype?: string;
}
export interface SPARQLSelectJSON {
  head: { vars: string[] };
  results: { bindings: Record<string, SPARQLBinding>[] };
}

export interface LogRecord {
  ts: string;
  status: string;
  sparql: string;
  validation: unknown;
  explain: unknown;
  undo_sparql?: string | null;
  error?: string | null;
}
export interface LogsRecent {
  items: LogRecord[];
}

export interface UndoRequest {
  undo_sparql?: string | null;
  log_record?: LogRecord;
}
export interface UndoResponse {
  ok: boolean;
  message: string;
}

export type PerfStats = {
  n: number;
  p50_ms: number;
  p95_ms: number;
  max_ms: number;
};

export type PerfMetrics = {
  window_minutes: number;
  http: PerfStats;
  fuseki: { select: PerfStats; update: PerfStats };
  top_http_paths: { path: string; count: number }[];
};
