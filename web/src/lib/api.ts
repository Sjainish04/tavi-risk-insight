import type { ExplainRequest, PatientInput, RiskOutput } from "./types";

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "/api";

async function http<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, init);
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`${res.status} ${res.statusText}: ${text}`);
  }
  return (await res.json()) as T;
}

export async function predict(input: PatientInput): Promise<RiskOutput> {
  return http<RiskOutput>("/predict", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export interface HealthInfo {
  status: string;
  version: string;
  model_loaded: boolean;
  llm_provider: string;
  region: string;
  granite_model_id: string;
}

export async function getHealth(): Promise<HealthInfo> {
  return http("/healthz");
}

/**
 * Stream the /explain endpoint. Uses fetch + ReadableStream because
 * EventSource only supports GET; sse-starlette emits standard SSE format.
 *
 * Calls `onToken` for each parsed token event, `onDone` when the stream ends.
 * Returns an abort handle so the caller can cancel.
 */
export function streamExplain(
  payload: ExplainRequest,
  onToken: (token: string) => void,
  onDone: () => void,
  onError: (err: Error) => void,
): () => void {
  const ctrl = new AbortController();

  (async () => {
    try {
      const res = await fetch(`${API_BASE}/explain`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "text/event-stream",
        },
        body: JSON.stringify(payload),
        signal: ctrl.signal,
      });
      if (!res.ok || !res.body) {
        throw new Error(`${res.status} ${res.statusText}`);
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        // SSE event boundaries are an empty line, which per spec may be
        // \n\n, \r\n\r\n, or \r\r. sse-starlette emits CRLF, so splitting
        // on the literal "\n\n" never matches and the buffer accumulates
        // the whole stream — tokens never reach onToken.
        const events = buf.split(/\r?\n\r?\n/);
        buf = events.pop() ?? "";
        for (const evt of events) {
          const lines = evt.split(/\r?\n/);
          let event = "message";
          const dataLines: string[] = [];
          for (const line of lines) {
            if (line.startsWith("event:")) {
              event = line.slice(6).trim();
            } else if (line.startsWith("data:")) {
              // SSE spec: skip exactly ONE optional leading space after the
              // colon. Do NOT trim — leading spaces inside tokens are
              // meaningful (e.g. " Clinical" needs the space preserved).
              dataLines.push(line.startsWith("data: ") ? line.slice(6) : line.slice(5));
            }
          }
          const data = dataLines.join("\n");
          if (event === "token" && data !== "") onToken(data);
          else if (event === "done") {
            onDone();
            return;
          }
        }
      }
      onDone();
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        onError(err as Error);
      }
    }
  })();

  return () => ctrl.abort();
}
