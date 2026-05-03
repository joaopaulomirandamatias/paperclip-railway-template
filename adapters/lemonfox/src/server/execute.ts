import type {
  AdapterExecutionContext,
  AdapterExecutionResult,
} from "@paperclipai/adapter-utils";
import { runChat } from "./modes/chat.js";
import { runTts } from "./modes/tts.js";
import { runStt } from "./modes/stt.js";
import { runImage } from "./modes/image.js";

const VALID_MODES = ["chat", "tts", "stt", "image"] as const;
type Mode = (typeof VALID_MODES)[number];

function resolveMode(config: Record<string, unknown>): Mode {
  const raw =
    typeof config.mode === "string" ? config.mode.trim().toLowerCase() : "";
  const m = raw || "chat";
  if ((VALID_MODES as readonly string[]).includes(m)) return m as Mode;
  throw new Error(
    `Invalid lemonfox mode "${m}". Expected one of: ${VALID_MODES.join(", ")}`,
  );
}

export async function execute(
  ctx: AdapterExecutionContext,
): Promise<AdapterExecutionResult> {
  const config = (ctx.config ?? {}) as Record<string, unknown>;
  let mode: Mode;
  try {
    mode = resolveMode(config);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await ctx.onLog("stderr", `[lemonfox] ${msg}\n`);
    return { exitCode: 2, signal: null, timedOut: false, errorMessage: msg };
  }

  await ctx.onLog("stdout", `[lemonfox] mode=${mode}\n`);

  try {
    switch (mode) {
      case "chat":
        return await runChat(ctx);
      case "tts":
        return await runTts(ctx);
      case "stt":
        return await runStt(ctx);
      case "image":
        return await runImage(ctx);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await ctx.onLog("stderr", `[lemonfox] ${msg}\n`);
    return {
      exitCode: 1,
      signal: null,
      timedOut: msg.toLowerCase().includes("abort"),
      errorMessage: msg,
      provider: "lemonfox",
    };
  }
}
