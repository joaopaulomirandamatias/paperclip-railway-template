import { promises as fs } from "node:fs";
import * as path from "node:path";
import type {
  AdapterExecutionContext,
  AdapterExecutionResult,
} from "@paperclipai/adapter-utils";
import { postForm, resolveApiKey, resolveBaseUrl } from "../client.js";

function asNum(v: unknown, fallback: number): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function isUrl(s: string): boolean {
  return /^https?:\/\//i.test(s);
}

export async function runStt(
  ctx: AdapterExecutionContext,
): Promise<AdapterExecutionResult> {
  const config = (ctx.config ?? {}) as Record<string, unknown>;
  const apiKey = resolveApiKey(config);
  const baseUrl = resolveBaseUrl(config);
  const timeoutMs = asNum(config.timeoutSec, 600) * 1000;

  const audioInput = typeof config.audioInput === "string" ? config.audioInput : "";
  if (!audioInput) {
    throw new Error("lemonfox stt: config.audioInput is required (path or URL).");
  }

  const responseFormat =
    typeof config.responseFormat === "string" ? config.responseFormat : "json";

  const form = new FormData();
  if (isUrl(audioInput)) {
    form.append("file", audioInput);
  } else {
    const abs = path.resolve(audioInput);
    const data = await fs.readFile(abs);
    const filename = path.basename(abs);
    form.append("file", new Blob([data]), filename);
  }
  form.append("response_format", responseFormat);
  if (typeof config.language === "string" && config.language) {
    form.append("language", config.language);
  }
  if (typeof config.prompt === "string" && config.prompt) {
    form.append("prompt", config.prompt);
  }
  if (config.translate === true) form.append("translate", "true");
  if (config.speakerLabels === true) form.append("speaker_labels", "true");
  if (typeof config.callbackUrl === "string" && config.callbackUrl) {
    form.append("callback_url", config.callbackUrl);
  }
  const granularities = config.timestampGranularities;
  if (Array.isArray(granularities)) {
    for (const g of granularities) {
      if (typeof g === "string") form.append("timestamp_granularities[]", g);
    }
  }

  await ctx.onLog(
    "stdout",
    `[lemonfox:stt] source=${isUrl(audioInput) ? "url" : "file"} fmt=${responseFormat}\n`,
  );

  const { text, contentType } = await postForm({
    baseUrl,
    apiKey,
    path: "/audio/transcriptions",
    form,
    timeoutMs,
  });

  let transcript: string = text;
  if (contentType.includes("application/json") && responseFormat === "json") {
    try {
      const parsed = JSON.parse(text) as { text?: string };
      if (typeof parsed.text === "string") transcript = parsed.text;
    } catch {
      /* keep raw text */
    }
  }

  await ctx.onLog("stdout", `[transcript]\n${transcript}\n`);

  return {
    exitCode: 0,
    signal: null,
    timedOut: false,
    provider: "lemonfox",
    model: "whisper",
  };
}
