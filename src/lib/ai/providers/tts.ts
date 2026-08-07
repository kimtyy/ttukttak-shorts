/**
 * Text-to-Speech (TTS) Voice Narration Provider
 * Converts scene narration text into audio MP3 data URLs or storage URLs.
 */

import OpenAI from "openai";

export interface GenerateAudioOptions {
  text: string;
  voiceStyle?: string; // VoiceStyle from @/types: 'calm_middle_aged_male' | 'warm_middle_aged_female' | 'bright_female' | 'trustworthy_male' | 'documentary_narrator'
  requestId?: string;
}

export interface AudioGenerationResult {
  audioUrl: string; // base64 data URL or HTTP URL
  provider: "openai-tts" | "browser-synthesis";
  mimeType: string;
}

export class TextToSpeechProvider {
  private openai: OpenAI | null = null;

  constructor() {
    if (process.env.OPENAI_API_KEY) {
      this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    }
  }

  /**
   * Generates audio narration MP3 from scene narration text.
   */
  async generateAudio(options: GenerateAudioOptions): Promise<AudioGenerationResult> {
    const { text, voiceStyle, requestId } = options;
    const cleanText = text.trim();

    if (!cleanText) {
      throw new Error("Narration text cannot be empty.");
    }

    if (this.openai) {
      try {
        const voice = this.mapVoiceStyle(voiceStyle);
        console.log(`[${requestId || "TTS"}] Generating audio narration via OpenAI TTS (voiceStyle=${voiceStyle} -> voice=${voice})...`);
        const mp3Response = await this.openai.audio.speech.create({
          model: "tts-1",
          voice,
          input: cleanText,
          response_format: "mp3",
          speed: 1.0,
        });

        const arrayBuffer = await mp3Response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const base64Audio = buffer.toString("base64");

        return {
          audioUrl: `data:audio/mp3;base64,${base64Audio}`,
          provider: "openai-tts",
          mimeType: "audio/mp3",
        };
      } catch (err: unknown) {
        console.warn(
          `[${requestId || "TTS"}] OpenAI TTS failed: ${err instanceof Error ? err.message : String(err)}.`
        );
      }
    }

    // Fallback: Client-side Browser Web Speech API fallback URL marker
    return {
      audioUrl: `speech://${encodeURIComponent(cleanText)}`,
      provider: "browser-synthesis",
      mimeType: "audio/wav",
    };
  }

  private mapVoiceStyle(voiceStyle?: string): "alloy" | "echo" | "fable" | "onyx" | "nova" | "shimmer" {
    switch (voiceStyle) {
      case "calm_middle_aged_male":
        return "onyx"; // 차분한 중년 남성 (기본값)
      case "warm_middle_aged_female":
        return "shimmer"; // 따뜻한 중년 여성
      case "bright_female":
        return "nova"; // 밝은 여성
      case "trustworthy_male":
        return "echo"; // 신뢰감 있는 남성
      case "documentary_narrator":
        return "fable"; // 다큐멘터리 내레이터
      default:
        return "onyx";
    }
  }
}
