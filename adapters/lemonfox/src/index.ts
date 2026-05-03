export const type = "lemonfox";
export const label = "Lemonfox AI";

export const models = [
  { id: "llama-8b-chat", label: "Llama 8B Chat" },
  { id: "llama-70b-chat", label: "Llama 70B Chat" },
];

export const agentConfigurationDoc = `# lemonfox configuration

Use when: an agent should run on Lemonfox AI's hosted endpoints
(chat, speech-to-text, text-to-speech, or SDXL image generation).

Don't use when: the agent needs tool use, MCP, or a coding-runtime
(Lemonfox is a stateless inference API, not an agent runtime).

## Required

- apiKey  — Lemonfox API key. Falls back to env LEMONFOX_API_KEY.

## Optional

- mode            — "chat" (default) | "tts" | "stt" | "image"
- model           — defaults per mode (chat: llama-70b-chat)
- baseUrl         — default https://api.lemonfox.ai/v1
- timeoutSec      — default 300
- promptTemplate  — supports {{taskTitle}}, {{taskBody}}, {{wakeReason}}, {{agentName}}, {{runId}}

### chat
- systemPrompt    — optional system message
- temperature, topP, maxTokens, frequencyPenalty, presencePenalty, stop

### tts
- voice            — default "sarah" (heart, bella, michael, alloy, ...)
- language         — default "en-us"
- responseFormat   — mp3 | opus | aac | flac | pcm | ogg | wav (default mp3)
- speed            — 0.5..4.0
- wordTimestamps   — boolean
- outputDir        — directory to write audio file (default os.tmpdir)

### stt
- audioInput       — file path or URL of audio (required)
- language         — optional, auto-detects
- responseFormat   — json | text | srt | verbose_json | vtt
- translate        — boolean (translate to English)
- speakerLabels    — boolean (verbose_json only)
- prompt           — guidance text for transcription style

### image
- negativePrompt
- n                — default 1
- size             — default 1024x1024
- responseFormat   — url (default) | b64_json
- outputDir        — when responseFormat=b64_json, write decoded files here
`;

export { createServerAdapter } from "./server/index.js";
