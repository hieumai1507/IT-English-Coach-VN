/**
 * Voice Pipeline: STT (whisper-1) → LLM (gpt-4o-mini) → TTS (tts-1)
 *
 * This is the cost-efficient alternative to gpt-4o-audio-preview (Speech-to-Speech).
 * Approximately 10x cheaper per conversation turn while maintaining quality.
 *
 * Flow:
 *   audio blob → whisper-1 transcript → gpt-4o-mini streaming text
 *              → sentence tokenizer → tts-1 per sentence → PCM audio chunks → SSE
 */
import { toFile } from "openai";
import { openai, type PriorMessage } from "./client";

export type VoicePipelineEvent =
  | { type: "user_transcript"; data: string }
  | { type: "transcript"; data: string }
  | { type: "audio"; data: string };

/**
 * Converts a short text sentence to PCM16 audio buffer using tts-1.
 * Returns a Buffer of raw 24kHz 16-bit mono PCM samples,
 * which is exactly what the frontend AudioWorklet expects.
 */
async function ttsToBuffer(
  text: string,
  signal?: AbortSignal
): Promise<Buffer> {
  const response = await openai.audio.speech.create(
    {
      model: "tts-1",
      voice: "alloy",
      input: text,
      response_format: "pcm",
    },
    { signal }
  );
  return Buffer.from(await response.arrayBuffer());
}

/**
 * Streams audio chunks from a PCM buffer over SSE in 4KB pieces.
 * Smaller chunks = smoother playback (AudioWorklet buffers them).
 */
async function* yieldAudioChunks(
  pcm: Buffer
): AsyncGenerator<VoicePipelineEvent> {
  const CHUNK_SIZE = 4096;
  for (let i = 0; i < pcm.length; i += CHUNK_SIZE) {
    yield {
      type: "audio",
      data: pcm.subarray(i, i + CHUNK_SIZE).toString("base64"),
    };
  }
}

/**
 * Checks if accumulated text ends at a natural sentence boundary.
 * Used to decide when to flush buffer to TTS.
 */
function isSentenceBoundary(text: string): boolean {
  return /[.!?。！？]\s*$/.test(text);
}

/**
 * Main voice pipeline. Takes audio blob + conversation context,
 * returns an async iterable of SSE events.
 *
 * Yields in order:
 *   1. user_transcript — what whisper heard
 *   2. transcript deltas — LLM text tokens as they stream
 *   3. audio chunks — PCM audio from TTS, interleaved with transcript
 */
export async function voicePipelineStream(
  audioBuffer: Buffer,
  inputFormat: "wav" | "mp3",
  context: PriorMessage[],
  options?: { signal?: AbortSignal }
): Promise<AsyncIterable<VoicePipelineEvent>> {
  const signal = options?.signal;

  return (async function* () {
    // ── 1. Speech-to-Text ────────────────────────────────────────────────────
    const file = await toFile(audioBuffer, `audio.${inputFormat}`, {
      type: `audio/${inputFormat}`,
    });

    const transcription = await openai.audio.transcriptions.create(
      { file, model: "whisper-1" },
      { signal }
    );

    const userText = transcription.text.trim();
    if (!userText) return;

    yield { type: "user_transcript" as const, data: userText };
    if (signal?.aborted) return;

    // ── 2. LLM streaming (gpt-4o-mini) ───────────────────────────────────────
    const llmStream = await openai.chat.completions.create(
      {
        model: "gpt-4o-mini",
        max_completion_tokens: 1024,
        messages: [
          ...context.map((m) => ({ role: m.role, content: m.content })),
          { role: "user" as const, content: userText },
        ],
        stream: true,
      },
      { signal }
    );

    // ── 3. Sentence-level TTS ─────────────────────────────────────────────────
    // Accumulate LLM tokens into sentences. When a sentence boundary is
    // detected (or buffer is too long), call TTS and stream the PCM audio.
    // This lets the first sentence of audio play before LLM finishes.
    const MAX_BUFFER_LEN = 250; // safety flush for very long sentences
    let sentenceBuffer = "";

    const flushBuffer = async function* (text: string) {
      const trimmed = text.trim();
      if (!trimmed || signal?.aborted) return;
      try {
        const pcm = await ttsToBuffer(trimmed, signal);
        if (!signal?.aborted) {
          yield* yieldAudioChunks(pcm);
        }
      } catch (err: unknown) {
        // If TTS fails (e.g. abort), skip silently — transcript was already sent
        if ((err as Error)?.name !== "AbortError") {
          console.error("[pipeline] TTS error:", err);
        }
      }
    };

    for await (const chunk of llmStream) {
      if (signal?.aborted) break;

      const token = chunk.choices[0]?.delta?.content ?? "";
      if (!token) continue;

      sentenceBuffer += token;
      yield { type: "transcript" as const, data: token };

      if (
        isSentenceBoundary(sentenceBuffer) ||
        sentenceBuffer.length >= MAX_BUFFER_LEN
      ) {
        yield* flushBuffer(sentenceBuffer);
        sentenceBuffer = "";
      }
    }

    // Flush any remaining text that didn't end with punctuation
    if (sentenceBuffer.trim().length > 0 && !signal?.aborted) {
      yield* flushBuffer(sentenceBuffer);
    }
  })();
}
