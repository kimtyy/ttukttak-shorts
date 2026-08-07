/**
 * Google Gemini Image Generation Provider
 * imagen-3.0-generate-002 was fully retired by Google (2025-11-10) and the
 * imagen-4.0-* family is scheduled for shutdown on 2026-08-17, so this calls
 * the native Gemini image model (gemini-3.1-flash-image) via the
 * generateContent endpoint instead of the legacy Imagen :predict endpoint.
 * Falls back to Pollinations AI if the Gemini call fails or no API key is set.
 */

export interface GenerateImageOptions {
  prompt: string;
  visualStyle?: string; // VisualStyle from @/types
  mood?: string; // Mood from @/types
  aspectRatio?: "9:16" | "1:1" | "16:9";
  requestId?: string;
}

// VisualStyle / Mood enum values (@/types) are DB-friendly codes, not prompt text
// (e.g. "animation_3d", "warm_photo") — map them to natural-language phrases for
// the actual image generation prompt.
const VISUAL_STYLE_PROMPT_MAP: Record<string, string> = {
  cinematic: "cinematic realistic photography",
  documentary: "documentary photography",
  animation_3d: "3D animated render",
  webtoon: "Korean webtoon illustration",
  watercolor: "watercolor painting",
  warm_photo: "warm nostalgic photograph",
};

const MOOD_PROMPT_MAP: Record<string, string> = {
  emotional: "emotional, touching",
  calm: "calm, serene",
  cheerful: "cheerful, upbeat",
  tense: "tense, suspenseful",
  hopeful: "hopeful, uplifting",
  serious: "serious, solemn",
};

export interface ImageGenerationResult {
  imageUrl: string; // base64 data URL or HTTP URL
  provider: "gemini-3.1-flash-image" | "dall-e-3" | "pollinations";
  mimeType: string;
}

export class GoogleImagenProvider {
  private apiKey: string;

  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "";
  }

  /**
   * Generates a 9:16 vertical short scene image using the Gemini image model.
   */
  async generateImage(options: GenerateImageOptions): Promise<ImageGenerationResult> {
    const { prompt, visualStyle, mood, aspectRatio = "9:16", requestId } = options;

    // Enhance prompt with style and mood for 9:16 vertical short format
    const enhancedPrompt = this.buildEnhancedPrompt(prompt, visualStyle, mood);

    if (this.apiKey) {
      try {
        console.log(`[${requestId || "IMAGEN"}] Generating image via Gemini (gemini-3.1-flash-image). prompt="${enhancedPrompt}"`);
        const result = await this.callGeminiImageApi(enhancedPrompt, aspectRatio);
        return result;
      } catch (err: unknown) {
        console.warn(
          `[${requestId || "IMAGEN"}] Gemini image generation failed: ${err instanceof Error ? err.message : String(err)}. Falling back to secondary provider.`
        );
      }
    } else {
      console.log(`[${requestId || "IMAGEN"}] GEMINI_API_KEY not set. Using Pollinations/DALL-E fallback provider.`);
    }

    // Fallback if Imagen key is missing or failed
    return this.generateFallbackImage(enhancedPrompt, aspectRatio);
  }

  private buildEnhancedPrompt(basePrompt: string, visualStyle?: string, mood?: string): string {
    const resolvedStyle = visualStyle ? VISUAL_STYLE_PROMPT_MAP[visualStyle] || visualStyle : "";
    const resolvedMood = mood ? MOOD_PROMPT_MAP[mood] || mood : "";
    const stylePart = resolvedStyle ? `, ${resolvedStyle} style` : "";
    const moodPart = resolvedMood ? `, ${resolvedMood} atmosphere` : "";
    return `${basePrompt}${stylePart}${moodPart}, vertical 9:16 portrait orientation, high resolution, detailed cinematic quality, 8k, vibrant lighting, centered framing for mobile short video format`;
  }

  private async callGeminiImageApi(prompt: string, aspectRatio: "9:16" | "1:1" | "16:9"): Promise<ImageGenerationResult> {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-image:generateContent?key=${this.apiKey}`;

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          responseModalities: ["TEXT", "IMAGE"],
          imageConfig: {
            aspectRatio,
          },
        },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Gemini image API HTTP ${response.status}: ${errText}`);
    }

    const data = await response.json();
    const parts = data.candidates?.[0]?.content?.parts as
      | Array<{ inlineData?: { data: string; mimeType?: string } }>
      | undefined;
    const imagePart = parts?.find((part) => part.inlineData?.data);

    if (!imagePart?.inlineData?.data) {
      throw new Error("Invalid response format from Gemini image API: no inline image data");
    }

    const base64Data = imagePart.inlineData.data;
    const mimeType = imagePart.inlineData.mimeType || "image/png";

    return {
      imageUrl: `data:${mimeType};base64,${base64Data}`,
      provider: "gemini-3.1-flash-image",
      mimeType,
    };
  }

  private generateFallbackImage(prompt: string, aspectRatio: "9:16" | "1:1" | "16:9"): ImageGenerationResult {
    // Generate high-resolution vertical image using Pollinations AI (free AI image endpoint)
    const encodedPrompt = encodeURIComponent(prompt);
    const width = aspectRatio === "9:16" ? 720 : 1080;
    const height = aspectRatio === "9:16" ? 1280 : 1080;
    const seed = Math.floor(Math.random() * 1000000);
    const fallbackUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=${width}&height=${height}&seed=${seed}&nologo=true`;

    return {
      imageUrl: fallbackUrl,
      provider: "pollinations",
      mimeType: "image/jpeg",
    };
  }
}
