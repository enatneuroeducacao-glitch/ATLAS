import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";

const read = (path) => {
  assert.ok(existsSync(path), `Arquivo essencial ausente: ${path}`);
  return readFileSync(path, "utf8");
};

const page = read("app/page.tsx");
const chat = read("app/api/chat/route.ts");
const tts = read("app/api/tts/route.ts");
const health = read("app/api/health/route.ts");
const speech = read("lib/speech-text.ts");
const audioStudio = read("components/AudioStudio.tsx");
const videoStudio = read("components/VideoStudio.tsx");
const knowledge = read("lib/enat-knowledge.ts");

const checks = [
  ["interface principal continua usando o endpoint de chat", page.includes('fetch("/api/chat"')],
  ["interface principal continua usando o endpoint de voz", page.includes('fetch("/api/tts"')],
  ["reconhecimento de voz do navegador continua presente", page.includes("SpeechRecognition") && page.includes("webkitSpeechRecognition")],
  ["histórico atual e chave legada continuam preservados", page.includes('atlas-conversations-v2') && page.includes('atlas-conversation-v1')],
  ["Estúdio de áudio continua integrado", page.includes("<AudioStudio") && audioStudio.includes('fetch("/api/tts"')],
  ["Estúdio de vídeo continua integrado", page.includes("<VideoStudio")],
  ["Estúdio de vídeo mantém salvamento automático local", videoStudio.includes("atlas.video-studio.script.v1") && videoStudio.includes("localStorage.setItem")],
  ["Estúdio de vídeo mantém renderização Mediabunny", videoStudio.includes('import("mediabunny")') && videoStudio.includes("addVideoTrack")],
  ["Estúdio de vídeo incorpora faixa de áudio no arquivo final", videoStudio.includes("addAudioTrack") && videoStudio.includes("audioSource.add(audioBuffer)")],
  ["Estúdio de vídeo mantém modos de gerar/baixar e pré-visualizar", videoStudio.includes('"download"') && videoStudio.includes('"preview"') && videoStudio.includes("download=")],
  ["endpoint de chat mantém a base de conhecimento ENAT", chat.includes("ENAT_KNOWLEDGE") && knowledge.length > 1000],
  ["endpoint de chat mantém validação do histórico", chat.includes("MAX_HISTORY_MESSAGES") && chat.includes("MAX_MESSAGE_CHARS")],
  ["TTS mantém modelo e voz configuráveis", tts.includes("GEMINI_TTS_MODEL") && tts.includes("GEMINI_TTS_VOICE")],
  ["TTS mantém orientação vocal aprovada", tts.includes("voz grave, encorpada, firme e acolhedora") && tts.includes('|| "Orus"')],
  ["TTS mantém fallback Piper", tts.includes("piperFallback") && tts.includes("PIPER_TTS_URL") && tts.includes("PIPER_API_TOKEN")],
  ["limpeza do texto falado continua isolada", tts.includes("cleanTextForSpeech") && speech.includes("export function cleanTextForSpeech")],
  ["health check continua sem expor segredos", health.includes("aiConfigured") && health.includes("voiceConfigured") && !health.includes("GEMINI_API_KEY:")],
];

let failures = 0;
for (const [label, passed] of checks) {
  if (passed) {
    process.stdout.write(`PASS ${label}\n`);
  } else {
    failures += 1;
    process.stderr.write(`FAIL ${label}\n`);
  }
}

process.stdout.write(`\\nResultado: ${checks.length - failures}/${checks.length} verificações aprovadas.\\n`);
if (failures) process.exitCode = 1;
