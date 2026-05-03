import { promises as fs } from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import type {
  AdapterExecutionContext,
  AdapterExecutionResult,
} from "@paperclipai/adapter-utils";
import { renderTemplate } from "@paperclipai/adapter-utils/server-utils";
import {
  postJson,
  resolveApiKey,
  resolveBaseUrl,
  resolveTimeoutMs,
} from "../client.js";

interface ImageResponse {
  created?: number;
  data?: Array<{ url?: string; b64_json?: string }>;
}

function asNum(v: unknown, fallback: number): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function resolvePrompt(ctx: AdapterExecutionContext): string {
  const config = ctx.config as Record<string, unknown>;
  if (typeof config.prompt === "string" && config.prompt) return config.prompt;
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
  throw new Error("lemonfox image: no prompt (set config.prompt or task body).");
}

export async function runImage(
  ctx: AdapterExecutionContext,
): Promise<AdapterExecutionResult> {
  const config = (ctx.config ?? {}) as Record<string, unknown>;
  const apiKey = resolveApiKey(config);
  const baseUrl = resolveBaseUrl(config);
  const timeoutMs = resolveTimeoutMs(config.timeoutSec, 300);

  const prompt = resolvePrompt(ctx);
  const negative =
    typeof config.negativePrompt === "string" ? config.negativePrompt : undefined;
  const n = config.n !== undefined ? Math.max(1, asNum(config.n, 1)) : 1;
  const size = typeof config.size === "string" ? config.size : "1024x1024";
  const responseFormat =
    typeof config.responseFormat === "string" ? config.responseFormat : "url";

  const body: Record<string, unknown> = {
    prompt,
    n,
    size,
    response_format: responseFormat,
  };
  if (negative) body.negative_prompt = negative;

  await ctx.onLog(
    "stdout",
    `[lemonfox:image] size=${size} n=${n} fmt=${responseFormat}\n`,
  );
  await ctx.onLog("stdout", `[prompt]\n${prompt}\n`);

  const data = await postJson<ImageResponse>({
    baseUrl,
    apiKey,
    path: "/images/generations",
    body,
    timeoutMs,
  });

  const items = data.data ?? [];
  if (responseFormat === "b64_json") {
    const outputDir =
      typeof config.outputDir === "string" && config.outputDir
        ? config.outputDir
        : os.tmpdir();
    await fs.mkdir(outputDir, { recursive: true });
    let i = 0;
    for (const item of items) {
      if (!item.b64_json) continue;
      const fname = `lemonfox-image-${ctx.runId}-${i++}.png`;
      const out = path.resolve(outputDir, fname);
      await fs.writeFile(out, Buffer.from(item.b64_json, "base64"));
      await ctx.onLog("stdout", `[image] saved ${out}\n`);
    }
  } else {
    for (const item of items) {
      if (item.url) await ctx.onLog("stdout", `[image] ${item.url}\n`);
    }
  }

  return {
    exitCode: items.length > 0 ? 0 : 1,
    signal: null,
    timedOut: false,
    provider: "lemonfox",
    model: "sdxl",
  };
}
