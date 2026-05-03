export const DEFAULT_BASE_URL = "https://api.lemonfox.ai/v1";

export class LemonfoxError extends Error {
  status: number;
  body: string;
  constructor(status: number, body: string) {
    super(`Lemonfox API error ${status}: ${body.slice(0, 500)}`);
    this.status = status;
    this.body = body;
  }
}

export function resolveApiKey(config: Record<string, unknown>): string {
  const k = config.apiKey;
  if (typeof k === "string" && k.trim()) return k.trim();
  const env = process.env.LEMONFOX_API_KEY;
  if (env && env.trim()) return env.trim();
  throw new Error(
    "Lemonfox apiKey not configured. Set adapterConfig.apiKey or LEMONFOX_API_KEY.",
  );
}

export function resolveBaseUrl(config: Record<string, unknown>): string {
  const u = config.baseUrl;
  if (typeof u === "string" && u.trim()) return u.replace(/\/+$/, "");
  return DEFAULT_BASE_URL;
}

export function authHeaders(apiKey: string): Record<string, string> {
  return { Authorization: `Bearer ${apiKey}` };
}

export interface LemonfoxJsonRequest {
  baseUrl: string;
  apiKey: string;
  path: string;
  body: unknown;
  timeoutMs: number;
  signal?: AbortSignal;
}

export async function postJson<T>(req: LemonfoxJsonRequest): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), req.timeoutMs);
  try {
    const res = await fetch(`${req.baseUrl}${req.path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders(req.apiKey),
      },
      body: JSON.stringify(req.body),
      signal: req.signal ?? ctrl.signal,
    });
    const text = await res.text();
    if (!res.ok) throw new LemonfoxError(res.status, text);
    return text ? (JSON.parse(text) as T) : (undefined as T);
  } finally {
    clearTimeout(timer);
  }
}

export interface LemonfoxFormRequest {
  baseUrl: string;
  apiKey: string;
  path: string;
  form: FormData;
  timeoutMs: number;
  signal?: AbortSignal;
  expectBinary?: boolean;
}

export async function postForm(
  req: LemonfoxFormRequest,
): Promise<{ contentType: string; text: string; buffer: ArrayBuffer }> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), req.timeoutMs);
  try {
    const res = await fetch(`${req.baseUrl}${req.path}`, {
      method: "POST",
      headers: authHeaders(req.apiKey),
      body: req.form,
      signal: req.signal ?? ctrl.signal,
    });
    const buf = await res.arrayBuffer();
    const text = new TextDecoder().decode(buf);
    if (!res.ok) throw new LemonfoxError(res.status, text);
    return {
      contentType: res.headers.get("content-type") ?? "",
      text,
      buffer: buf,
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function postBinary(req: LemonfoxJsonRequest): Promise<{
  buffer: ArrayBuffer;
  contentType: string;
}> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), req.timeoutMs);
  try {
    const res = await fetch(`${req.baseUrl}${req.path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders(req.apiKey),
      },
      body: JSON.stringify(req.body),
      signal: req.signal ?? ctrl.signal,
    });
    if (!res.ok) {
      const text = await res.text();
      throw new LemonfoxError(res.status, text);
    }
    return {
      buffer: await res.arrayBuffer(),
      contentType: res.headers.get("content-type") ?? "",
    };
  } finally {
    clearTimeout(timer);
  }
}
