import { promises as fs } from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import type {
  AdapterExecutionContext,
  AdapterExecutionResult,
} from "@paperclipai/adapter-utils";
import { renderTemplate } from "@paperclipai/adapter-utils/server-utils";
import { postBinary, resolveApiKey, resolveBaseUrl } from "../client.js";

function asNum(v: unknown, fallback: number): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function resolveInput(ctx: AdapterExecutionContext): string {
  const config = ctx.config as Record<string, unknown>;
  if (typeof config.input === "string" && config.input) return config.input;
  if (typeof config.promptTemplate === "string" && config.promptTemplate) {
    return renderTemplate(config.promptTemplate, {
      agentId: ctx.agent.id,
      agentName: ctx.agent.name,
      runId: ctx.runId,
      taskId: String(ctx.context.taskId ?? ""),
      taskTitle: String(ctx.context.taskTitle ?? ""),
      taskBody: String(ctx.context.taskBody ?? ""),
    });
  }
  if (typeof ctx.context.taskBody === "string" && ctx.context.taskBody) {
    return ctx.context.taskBody;
  }
  if (typeof ctx.context.taskTitle === "string" && ctx.context.taskTitle) {
    return ctx.context.taskTitle;
  }
  throw new Error("lemonfox tts: no input text (set config.input or task body).");
}

export async function runTts(
  ctx: AdapterExecutionContext,
): Promise<AdapterExecutionResult> {
  const config = (ctx.config ?? {}) as Record<string, unknown>;
  const apiKey = resolveApiKey(config);
  const baseUrl = resolveBaseUrl(config);
  const timeoutMs = asNum(config.timeoutSec, 300) * 1000;

  const input = resolveInput(ctx);
  const voice = typeof config.voice === "string" ? config.voice : "sarah";
  const language = typeof config.language === "string" ? config.language : "en-us";
  const responseFormat =
    typeof config.responseFormat === "string" ? config.responseFormat : "mp3";
  const speed = config.speed !== undefined ? asNum(config.speed, 1) : undefined;
  const wordTimestamps = config.wordTimestamps === true;
  const outputDir =
    typeof config.outputDir === "string" && config.outputDir
      ? config.outputDir
      : os.tmpdir();

  const body: Record<string, unknown> = {
    input,
    voice,
    language,
    response_format: responseFormat,
  };
  if (speed !== undefined) body.speed = speed;
  if (wordTimestamps) body.word_timestamps = true;

  await ctx.onLog(
    "stdout",
    `[lemonfox:tts] voice=${voice} lang=${language} fmt=${responseFormat} chars=${input.length}\n`,
  );

  const { buffer, contentType } = await postBinary({
    baseUrl,
    apiKey,
    path: "/audio/speech",
    body,
    timeoutMs,
  });

  await fs.mkdir(outputDir, { recursive: true });
  const filename = `lemonfox-tts-${ctx.runId}.${responseFormat}`;
  const outPath = path.resolve(outputDir, filename);
  await fs.writeFile(outPath, Buffer.from(buffer));

  await ctx.onLog(
    "stdout",
    `[lemonfox:tts] wrote ${buffer.byteLength} bytes (${contentType}) -> ${outPath}\n`,
  );

  return {
    exitCode: 0,
    signal: null,
    timedOut: false,
    provider: "lemonfox",
    model: `tts/${voice}`,
  };
}
