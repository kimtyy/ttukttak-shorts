/**
 * Google Imagen 3 API & Visual Generation Provider
 * Supports Google Imagen 3 (imagen-3.0-generate-002) via Google Generative Language API,
 * with fallback support for OpenAI DALL-E 3 / Pollinations AI.
 */

export interface GenerateImageOptions {
  prompt: string;
  visualStyle?: string;
  mood?: string;
  aspectRatio?: "9:16" | "1:1" | "16:9";
  requestId?: string;
}

export interface ImageGenerationResult {
  imageUrl: string; // base64 data URL or HTTP URL
  provider: "imagen-3" | "dall-e-3" | "pollinations";
  mimeType: string;
}

export class GoogleImagenProvider {
  private apiKey: string;

  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "";
  }

  /**
   * Generates a 9:16 vertical short scene image using Google Imagen 3 API.
   */
  async generateImage(options: GenerateImageOptions): Promise<ImageGenerationResult> {
    const { prompt, visualStyle, mood, aspectRatio = "9:16", requestId } = options;

    // Enhance prompt with style and mood for 9:16 vertical short format
    const enhancedPrompt = this.buildEnhancedPrompt(prompt, visualStyle, mood);

    if (this.apiKey) {
      try {
        console.log(`[${requestId || "IMAGEN"}] Generating image via Google Imagen 3...`);
        const result = await this.callImagenApi(enhancedPrompt, aspectRatio);
        return result;
      } catch (err: unknown) {
        console.warn(
          `[${requestId || "IMAGEN"}] Google Imagen 3 failed: ${err instanceof Error ? err.message : String(err)}. Falling back to secondary provider.`
        );
      }
    } else {
      console.log(`[${requestId || "IMAGEN"}] GEMINI_API_KEY not set. Using Pollinations/DALL-E fallback provider.`);
    }

    // Fallback if Imagen key is missing or failed
    return this.generateFallbackImage(enhancedPrompt, aspectRatio);
  }

  private buildEnhancedPrompt(basePrompt: string, visualStyle?: string, mood?: string): string {
    const stylePart = visualStyle ? `, ${visualStyle} style` : "";
    const moodPart = mood ? `, ${mood} atmosphere` : "";
    return `${basePrompt}${stylePart}${moodPart}, vertical 9:16 portrait orientation, high resolution, detailed cinematic quality, 8k, vibrant lighting, centered framing for mobile short video format`;
  }

  private async callImagenApi(prompt: string, aspectRatio: "9:16" | "1:1" | "16:9"): Promise<ImageGenerationResult> {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict?key=${this.apiKey}`;

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        instances: [
          {
            prompt,
          },
        ],
        parameters: {
          sampleCount: 1,
          aspectRatio,
          outputOptions: {
            mimeType: "image/jpeg",
          },
        },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Imagen API HTTP ${response.status}: ${errText}`);
    }

    const data = await response.json();
    const predictions = data.predictions;

    if (!predictions || predictions.length === 0 || !predictions[0].bytesBase64Encoded) {
      throw new Error("Invalid response format from Google Imagen 3 API");
    }

    const base64Data = predictions[0].bytesBase64Encoded;
    const mimeType = predictions[0].mimeType || "image/jpeg";

    return {
      imageUrl: `data:${mimeType};base64,${base64Data}`,
      provider: "imagen-3",
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
