import type {
  ServerAdapterModule,
  AdapterSessionCodec,
} from "@paperclipai/adapter-utils";
import { type, models, agentConfigurationDoc } from "../index.js";
import { execute } from "./execute.js";
import { testEnvironment } from "./test.js";

type ListSkills = NonNullable<ServerAdapterModule["listSkills"]>;
type SyncSkills = NonNullable<ServerAdapterModule["syncSkills"]>;

const listSkills: ListSkills = async (ctx) => {
  const raw = (ctx as { desiredSkills?: unknown }).desiredSkills;
  const ids = Array.isArray(raw)
    ? raw.filter((x): x is string => typeof x === "string")
    : [];
  return {
    adapterType: ctx.adapterType,
    supported: true,
    mode: "ephemeral",
    desiredSkills: ids,
    entries: [],
    warnings: [],
  };
};

const syncSkills: SyncSkills = async (ctx, desired) => {
  const ids = Array.isArray(desired)
    ? desired.filter((x): x is string => typeof x === "string")
    : [];
  return {
    adapterType: ctx.adapterType,
    supported: true,
    mode: "ephemeral",
    desiredSkills: ids,
    entries: [],
    warnings: [],
  };
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
