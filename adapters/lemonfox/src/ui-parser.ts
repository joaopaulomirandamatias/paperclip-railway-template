type TranscriptEntry =
  | { kind: "assistant"; ts: string; text: string }
  | { kind: "thinking"; ts: string; text: string }
  | { kind: "user"; ts: string; text: string }
  | { kind: "tool_call"; ts: string; name: string; input: unknown; toolUseId?: string }
  | { kind: "tool_result"; ts: string; toolUseId: string; content: string; isError: boolean }
  | { kind: "system"; ts: string; text: string }
  | { kind: "stderr"; ts: string; text: string }
  | { kind: "stdout"; ts: string; text: string };

type Section = "user" | "assistant" | "transcript" | "prompt" | "image" | null;

export function createStdoutParser() {
  let counter = 0;
  let section: Section = null;
  let buffer: string[] = [];
  let bufferTs = "";
  let activeToolId: string | null = null;

  function flush(): TranscriptEntry[] {
    if (buffer.length === 0) {
      section = null;
      return [];
    }
    const text = buffer.join("\n").trim();
    const ts = bufferTs;
    const sec = section;
    buffer = [];
    section = null;
    if (!text) return [];

    if (sec === "user") return [{ kind: "user", ts, text }];
    if (sec === "assistant") return [{ kind: "assistant", ts, text }];
    if (sec === "prompt") return [{ kind: "user", ts, text }];
    if (sec === "transcript" && activeToolId) {
      const id = activeToolId;
      activeToolId = null;
      return [
        { kind: "tool_result", ts, toolUseId: id, content: text, isError: false },
      ];
    }
    if (sec === "image") return [{ kind: "system", ts, text }];
    return [{ kind: "stdout", ts, text }];
  }

  function parseLine(line: string, ts: string): TranscriptEntry[] {
    if (line.startsWith("[lemonfox")) {
      const out = flush();
      out.push({ kind: "system", ts, text: line });
      return out;
    }
    if (line === "[user]") {
      const out = flush();
      section = "user";
      bufferTs = ts;
      return out;
    }
    if (line === "[assistant]") {
      const out = flush();
      section = "assistant";
      bufferTs = ts;
      return out;
    }
    if (line === "[prompt]") {
      const out = flush();
      section = "prompt";
      bufferTs = ts;
      return out;
    }
    if (line === "[transcript]") {
      const out = flush();
      section = "transcript";
      bufferTs = ts;
      const id = `lemonfox-stt-${++counter}`;
      activeToolId = id;
      out.push({
        kind: "tool_call",
        ts,
        name: "speech_to_text",
        input: {},
        toolUseId: id,
      });
      return out;
    }
    if (line.startsWith("[image]")) {
      const out = flush();
      out.push({ kind: "system", ts, text: line });
      return out;
    }

    if (section !== null) {
      buffer.push(line);
      return [];
    }

    if (!line.trim()) return [];
    return [{ kind: "stdout", ts, text: line }];
  }

  function reset() {
    counter = 0;
    section = null;
    buffer = [];
    bufferTs = "";
    activeToolId = null;
  }

  return { parseLine, reset };
}

export function parseStdoutLine(line: string, ts: string): TranscriptEntry[] {
  if (line.startsWith("[lemonfox")) return [{ kind: "system", ts, text: line }];
  if (!line.trim()) return [];
  return [{ kind: "stdout", ts, text: line }];
}
