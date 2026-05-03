import { promises as fs } from "node:fs";
import type {
  AdapterExecutionContext,
  AdapterExecutionResult,
} from "@paperclipai/adapter-utils";
import { renderTemplate } from "@paperclipai/adapter-utils/server-utils";
import { postJson, resolveApiKey, resolveBaseUrl } from "../client.js";

async function loadInstructionsBundle(
  config: Record<string, unknown>,
): Promise<string | null> {
  const p = config.instructionsFilePath;
  if (typeof p !== "string" || !p) return null;
  try {
    const content = await fs.readFile(p, "utf8");
    return content.trim() || null;
  } catch {
    return null;
  }
}

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface ChatResponse {
  id?: string;
  model?: string;
  choices?: Array<{
    index?: number;
    message?: { role: string; content: string };
    finish_reason?: string;
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
}

const DEFAULT_MODEL = "llama-70b-chat";

function asNum(v: unknown, fallback: number): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function buildPrompt(ctx: AdapterExecutionContext): string {
  const config = ctx.config as Record<string, unknown>;
  const tpl = typeof config.promptTemplate === "string" ? config.promptTemplate : "";
  if (!tpl) {
    const reason = ctx.context.wakeReason ?? "scheduled";
    const title = ctx.context.taskTitle ?? "(no task)";
    return `You woke for reason: ${reason}.\nTask: ${title}\nPlease respond.`;
  }
  return renderTemplate(tpl, {
    agentId: ctx.agent.id,
    agentName: ctx.agent.name,
    companyId: ctx.agent.companyId,
    runId: ctx.runId,
    taskId: String(ctx.context.taskId ?? ""),
    taskTitle: String(ctx.context.taskTitle ?? ""),
    taskBody: String(ctx.context.taskBody ?? ""),
    wakeReason: String(ctx.context.wakeReason ?? ""),
  });
}

function loadHistory(ctx: AdapterExecutionContext): ChatMessage[] {
  const raw = ctx.runtime.sessionParams;
  if (!raw || typeof raw !== "object") return [];
  const msgs = (raw as { messages?: unknown }).messages;
  if (!Array.isArray(msgs)) return [];
  const out: ChatMessage[] = [];
  for (const m of msgs) {
    if (m && typeof m === "object") {
      const r = (m as { role?: unknown }).role;
      const c = (m as { content?: unknown }).content;
      if (
        (r === "system" || r === "user" || r === "assistant") &&
        typeof c === "string"
      ) {
        out.push({ role: r, content: c });
      }
    }
  }
  return out;
}

export async function runChat(
  ctx: AdapterExecutionContext,
): Promise<AdapterExecutionResult> {
  const config = (ctx.config ?? {}) as Record<string, unknown>;
  const apiKey = resolveApiKey(config);
  const baseUrl = resolveBaseUrl(config);
  const model = typeof config.model === "string" && config.model
    ? config.model
    : DEFAULT_MODEL;
  const timeoutMs = asNum(config.timeoutSec, 300) * 1000;

  const history = loadHistory(ctx);
  const messages: ChatMessage[] = [...history];
  if (messages.length === 0) {
    const parts: string[] = [];
    const bundle = await loadInstructionsBundle(config);
    if (bundle) parts.push(bundle);
    if (typeof config.systemPrompt === "string" && config.systemPrompt) {
      parts.push(config.systemPrompt);
    }
    if (parts.length > 0) {
      messages.push({ role: "system", content: parts.join("\n\n") });
    }
  }
  const userPrompt = buildPrompt(ctx);
  messages.push({ role: "user", content: userPrompt });

  await ctx.onLog("stdout", `[lemonfox:chat] model=${model} messages=${messages.length}\n`);
  await ctx.onLog("stdout", `[user]\n${userPrompt}\n`);

  const body: Record<string, unknown> = {
    model,
    messages,
    stream: false,
  };
  if (config.temperature !== undefined) body.temperature = asNum(config.temperature, 1);
  if (config.topP !== undefined) body.top_p = asNum(config.topP, 1);
  if (config.maxTokens !== undefined) body.max_tokens = asNum(config.maxTokens, 0);
  if (config.frequencyPenalty !== undefined)
    body.frequency_penalty = asNum(config.frequencyPenalty, 0);
  if (config.presencePenalty !== undefined)
    body.presence_penalty = asNum(config.presencePenalty, 0);
  if (config.stop !== undefined) body.stop = config.stop;

  if (ctx.onMeta) {
    try {
      await ctx.onMeta({
        provider: "lemonfox",
        model,
      } as Parameters<NonNullable<typeof ctx.onMeta>>[0]);
    } catch {
      /* onMeta is best-effort */
    }
  }

  await ctx.onLog("stdout", `[lemonfox:chat] sending request to ${baseUrl}/chat/completions\n`);
  const startedAt = Date.now();
  const keepalive = setInterval(() => {
    const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
    void ctx.onLog("stdout", `[lemonfox:chat] waiting... ${elapsed}s\n`);
  }, 1000);

  let data: ChatResponse;
  try {
    data = await postJson<ChatResponse>({
      baseUrl,
      apiKey,
      path: "/chat/completions",
      body,
      timeoutMs,
    });
  } finally {
    clearInterval(keepalive);
  }

  const choice = data.choices?.[0];
  const reply = choice?.message?.content ?? "";
  const finish = choice?.finish_reason ?? "stop";

  await ctx.onLog("stdout", `[assistant]\n${reply}\n`);
  await ctx.onLog("stdout", `[lemonfox:chat] finish_reason=${finish}\n`);

  const newHistory: ChatMessage[] = [...messages];
  if (reply) newHistory.push({ role: "assistant", content: reply });

  const usage = data.usage ?? {};
  return {
    exitCode: 0,
    signal: null,
    timedOut: false,
    usage: {
      inputTokens: usage.prompt_tokens ?? 0,
      outputTokens: usage.completion_tokens ?? 0,
    },
    sessionParams: { messages: newHistory, model },
    sessionDisplayId: data.id ?? null,
    provider: "lemonfox",
    model: data.model ?? model,
  };
}
