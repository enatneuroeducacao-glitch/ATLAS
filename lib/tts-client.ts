export type TtsProgress = { completed: number; total: number; percent: number; current: number };

type ResumeJob = { source: string; chunks: string[]; audio: Uint8Array[] };

const TARGET_CHARS = 2200;
const MAX_CHARS = 2800;
const jobs = new Map<string, ResumeJob>();

function splitLongUnit(value: string): string[] {
  const words = value.split(/\s+/);
  const parts: string[] = [];
  let current = "";
  for (const word of words) {
    if (word.length > MAX_CHARS) {
      if (current) parts.push(current);
      current = "";
      for (let i = 0; i < word.length; i += MAX_CHARS) parts.push(word.slice(i, i + MAX_CHARS));
      continue;
    }
    const next = current ? current + " " + word : word;
    if (next.length > TARGET_CHARS && current) {
      parts.push(current);
      current = word;
    } else current = next;
  }
  if (current) parts.push(current);
  return parts;
}

export function splitSpeechText(input: string): string[] {
  const paragraphs = input.replace(/\r\n?/g, "\n").split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
  const units: string[] = [];
  for (const paragraph of paragraphs.length ? paragraphs : [input.trim()]) {
    const sentences = paragraph.match(/[^.!?]+[.!?]+["'”’)]*|[^.!?]+$/g) || [paragraph];
    for (const sentence of sentences.map(s => s.trim()).filter(Boolean)) {
      if (sentence.length <= TARGET_CHARS) units.push(sentence);
      else units.push(...splitLongUnit(sentence));
    }
  }
  const chunks: string[] = [];
  let current = "";
  for (const unit of units) {
    const next = current ? current + " " + unit : unit;
    if (next.length > MAX_CHARS && current) {
      chunks.push(current.trim());
      current = unit;
    } else current = next;
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks;
}

function extractWav(bytes: Uint8Array): { format: Uint8Array; audio: Uint8Array } {
  if (bytes.length < 44 || String.fromCharCode(...bytes.subarray(0, 4)) !== "RIFF" ||
      String.fromCharCode(...bytes.subarray(8, 12)) !== "WAVE") {
    throw new Error("O Gemini retornou um bloco que não é WAV válido.");
  }
  let offset = 12;
  let format: Uint8Array | null = null;
  let audio: Uint8Array | null = null;
  while (offset + 8 <= bytes.length) {
    const id = String.fromCharCode(...bytes.subarray(offset, offset + 4));
    const size = new DataView(bytes.buffer, bytes.byteOffset + offset + 4, 4).getUint32(0, true);
    const start = offset + 8;
    const end = start + size;
    if (end > bytes.length) throw new Error("O WAV retornado pelo Gemini está incompleto.");
    if (id === "fmt ") format = bytes.slice(start, end);
    if (id === "data") audio = bytes.slice(start, end);
    offset = end + (size % 2);
  }
  if (!format || format.length < 16 || !audio?.length) {
    throw new Error("O WAV do Gemini não contém os blocos de formato e áudio esperados.");
  }
  return { format, audio };
}

export function mergeWavChunks(chunks: Uint8Array[]): Uint8Array {
  if (!chunks.length) throw new Error("Nenhum bloco de áudio foi concluído.");
  const parsed = chunks.map(extractWav);
  const format = parsed[0].format;
  for (const item of parsed.slice(1)) {
    if (item.format.length !== format.length || item.format.some((v, i) => v !== format[i])) {
      throw new Error("O Gemini retornou parâmetros de áudio diferentes entre blocos. Os trechos foram preservados para nova tentativa.");
    }
  }
  const audioLength = parsed.reduce((sum, item) => sum + item.audio.length, 0);
  const output = new Uint8Array(12 + 8 + format.length + 8 + audioLength);
  const view = new DataView(output.buffer);
  const write = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i++) output[offset + i] = value.charCodeAt(i);
  };
  write(0, "RIFF");
  view.setUint32(4, output.length - 8, true);
  write(8, "WAVE");
  write(12, "fmt ");
  view.setUint32(16, format.length, true);
  output.set(format, 20);
  const dataHeader = 20 + format.length;
  write(dataHeader, "data");
  view.setUint32(dataHeader + 4, audioLength, true);
  let cursor = dataHeader + 8;
  for (const item of parsed) {
    output.set(item.audio, cursor);
    cursor += item.audio.length;
  }
  return output;
}

export async function generateLongSpeech(
  source: string,
  onProgress: (progress: TtsProgress) => void,
): Promise<Uint8Array> {
  const key = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(source))
    .then(hash => Array.from(new Uint8Array(hash), b => b.toString(16).padStart(2, "0")).join(""));
  const chunks = splitSpeechText(source);
  let job = jobs.get(key);
  if (!job || job.source !== source || job.chunks.length !== chunks.length) {
    job = { source, chunks, audio: [] };
    jobs.set(key, job);
  }
  for (let index = job.audio.length; index < job.chunks.length; index++) {
    onProgress({ completed: index, total: job.chunks.length, percent: Math.round(index / job.chunks.length * 100), current: index + 1 });
    const response = await fetch("/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: job.chunks[index] }),
      signal: AbortSignal.timeout(110000),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error("Bloco " + (index + 1) + " de " + job.chunks.length + ": " + (data.error || "falha na geração. O texto e os blocos anteriores foram preservados; tente novamente para continuar deste ponto."));
    }
    const blob = await response.blob();
    if (!blob.type.toLowerCase().includes("wav")) {
      throw new Error("Bloco " + (index + 1) + ": o Gemini não retornou WAV. Os blocos anteriores foram preservados.");
    }
    const bytes = new Uint8Array(await blob.arrayBuffer());
    extractWav(bytes);
    job.audio.push(bytes);
    onProgress({ completed: job.audio.length, total: job.chunks.length, percent: Math.round(job.audio.length / job.chunks.length * 100), current: Math.min(job.audio.length + 1, job.chunks.length) });
  }
  const merged = mergeWavChunks(job.audio);
  jobs.delete(key);
  return merged;
}
