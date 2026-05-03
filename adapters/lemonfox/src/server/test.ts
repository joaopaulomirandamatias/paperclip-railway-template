import type {
  AdapterEnvironmentTestContext,
  AdapterEnvironmentTestResult,
} from "@paperclipai/adapter-utils";
import { DEFAULT_BASE_URL, authHeaders } from "./client.js";

const VALID_MODES = ["chat", "tts", "stt", "image"];

interface Check {
  level: "info" | "warn" | "error";
  message: string;
  hint?: string;
  code: string;
}

export async function testEnvironment(
  ctx: AdapterEnvironmentTestContext,
): Promise<AdapterEnvironmentTestResult> {
  const config = (ctx.config ?? {}) as Record<string, unknown>;
  const checks: Check[] = [];

  const apiKey =
    typeof config.apiKey === "string" && config.apiKey
      ? config.apiKey
      : process.env.LEMONFOX_API_KEY ?? "";
  if (!apiKey) {
    checks.push({
      level: "error",
      message: "Lemonfox API key not configured.",
      hint: "Set adapterConfig.apiKey or LEMONFOX_API_KEY env var.",
      code: "no_api_key",
    });
  } else {
    checks.push({
      level: "info",
      message: `API key present (${apiKey.length} chars).`,
      code: "api_key_present",
    });
  }

  const modeRaw =
    typeof config.mode === "string" ? config.mode.trim().toLowerCase() : "";
  const mode = modeRaw || "chat";
  if (!VALID_MODES.includes(mode)) {
    checks.push({
      level: "error",
      message: `Invalid mode "${mode}".`,
      hint: `Use one of: ${VALID_MODES.join(", ")}`,
      code: "invalid_mode",
    });
  } else {
    checks.push({
      level: "info",
      message: `Mode: ${mode}`,
      code: "mode_ok",
    });
  }

  if (mode === "stt") {
    const audioInput = typeof config.audioInput === "string" ? config.audioInput : "";
    if (!audioInput) {
      checks.push({
        level: "warn",
        message: "stt mode without audioInput.",
        hint: "Set config.audioInput to a file path or URL.",
        code: "stt_no_input",
      });
    }
  }

  const baseUrl =
    typeof config.baseUrl === "string" && config.baseUrl
      ? config.baseUrl
      : DEFAULT_BASE_URL;

  if (apiKey) {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 8000);
      const res = await fetch(`${baseUrl.replace(/\/+$/, "")}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders(apiKey) },
        body: JSON.stringify({
          model: "llama-8b-chat",
          messages: [{ role: "user", content: "ping" }],
          max_tokens: 1,
        }),
        signal: ctrl.signal,
      });
      clearTimeout(timer);
      if (res.status === 401 || res.status === 403) {
        checks.push({
          level: "error",
          message: `Auth rejected (HTTP ${res.status}).`,
          hint: "Check that LEMONFOX_API_KEY is valid and not expired.",
          code: "auth_failed",
        });
      } else if (res.status >= 500) {
        checks.push({
          level: "warn",
          message: `Lemonfox returned ${res.status}.`,
          code: "server_5xx",
        });
      } else {
        checks.push({
          level: "info",
          message: `Reachable at ${baseUrl} (HTTP ${res.status}).`,
          code: "reachable",
        });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      checks.push({
        level: "warn",
        message: `Network probe failed: ${msg}`,
        hint: "Check baseUrl and outbound connectivity.",
        code: "probe_failed",
      });
    }
  }

  const hasError = checks.some((c) => c.level === "error");
  const hasWarn = checks.some((c) => c.level === "warn");
  return {
    adapterType: ctx.adapterType,
    status: hasError ? "fail" : hasWarn ? "warn" : "pass",
    checks,
    testedAt: new Date().toISOString(),
  };
}
