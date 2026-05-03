import type {
  ServerAdapterModule,
  AdapterSessionCodec,
} from "@paperclipai/adapter-utils";
import { type, models, agentConfigurationDoc } from "../index.js";
import { execute } from "./execute.js";
import { testEnvironment } from "./test.js";

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
  };
}
