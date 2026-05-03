import type {
  ServerAdapterModule,
  AdapterSessionCodec,
} from "@paperclipai/adapter-utils";
import { type, models, agentConfigurationDoc } from "../index.js";
import { execute } from "./execute.js";
import { testEnvironment } from "./test.js";

type ListSkills = NonNullable<ServerAdapterModule["listSkills"]>;
type SyncSkills = NonNullable<ServerAdapterModule["syncSkills"]>;

function buildSkillsResult(
  adapterType: string,
  desired: ReadonlyArray<Record<string, unknown>>,
) {
  const entries = desired.map((s) => ({
    skillId: String(s.skillId ?? s.id ?? s.name ?? ""),
    name: typeof s.name === "string" ? s.name : String(s.skillId ?? ""),
    version: typeof s.version === "string" ? s.version : null,
    status: "applied" as const,
    source: "ephemeral" as const,
  }));
  return {
    adapterType,
    supported: true,
    mode: "ephemeral" as const,
    desiredSkills: desired,
    entries,
    warnings: [],
  };
}

const listSkills: ListSkills = async (ctx) => {
  const desired =
    (ctx as { desiredSkills?: unknown }).desiredSkills ?? [];
  const list = Array.isArray(desired)
    ? (desired as Array<Record<string, unknown>>)
    : [];
  return buildSkillsResult(ctx.adapterType, list) as Awaited<
    ReturnType<ListSkills>
  >;
};

const syncSkills: SyncSkills = async (ctx, desired) => {
  const list = Array.isArray(desired)
    ? (desired as Array<Record<string, unknown>>)
    : [];
  return buildSkillsResult(ctx.adapterType, list) as Awaited<
    ReturnType<SyncSkills>
  >;
};

const sessionCodec: AdapterSessionCodec = {
  deserialize(raw) {
    if (!raw || typeof raw !== "object") return null;
    const r = raw as Record<string, unknown>;
    if (!Array.isArray(r.messages)) return null;
    return { messages: r.messages, model: r.model ?? null };
  },
  serialize(params) {
    if (!params) return null;
    const messages = (params as { messages?: unknown }).messages;
    if (!Array.isArray(messages)) return null;
    return {
      messages,
      model: (params as { model?: unknown }).model ?? null,
    };
  },
  getDisplayId(params) {
    if (!params) return null;
    const messages = (params as { messages?: unknown[] }).messages;
    return Array.isArray(messages) ? `chat (${messages.length} msgs)` : null;
  },
};

export function createServerAdapter(): ServerAdapterModule {
  return {
    type,
    execute,
    testEnvironment,
    models,
    agentConfigurationDoc,
    sessionCodec,
    supportsInstructionsBundle: true,
    instructionsPathKey: "instructionsFilePath",
    listSkills,
    syncSkills,
  };
}
