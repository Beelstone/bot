
import { GoogleGenAI, GenerateContentResponse, Type } from "@google/genai";
import { MODELS } from "../constants";
import { Attachment } from "../types";

const aiStudio = (window as any).aistudio;

export class GeminiService {
  private static instance: GeminiService;
  
  private constructor() {}

  static getInstance(): GeminiService {
    if (!GeminiService.instance) {
      GeminiService.instance = new GeminiService();
    }
    return GeminiService.instance;
  }

  private async ensureApiKey(): Promise<void> {
    const hasKey = await aiStudio.hasSelectedApiKey();
    if (!hasKey) {
      await aiStudio.openSelectKey();
    }
  }

  async sendTextMessage(prompt: string, modelId: string, attachment?: Attachment) {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const parts: any[] = [{ text: prompt }];
    if (attachment) {
      parts.push({
        inlineData: {
          data: attachment.data,
          mimeType: attachment.mimeType
        }
      });
    }

    const response = await ai.models.generateContent({
      model: modelId,
      contents: { parts },
      config: {
        systemInstruction: "You are a versatile AI assistant living inside a Telegram-like interface. You are powered by Google Gemini. Be concise and friendly.",
      }
    });
    
    return response.text;
  }

  async generateImage(prompt: string, modelId: string, aspectRatio: string = "1:1") {
    await this.ensureApiKey();
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    try {
      const response = await ai.models.generateContent({
        model: modelId,
        contents: { parts: [{ text: prompt }] },
        config: {
          imageConfig: {
            aspectRatio: aspectRatio as any,
            imageSize: "1K"
          }
        }
      });

      for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) {
          return `data:image/png;base64,${part.inlineData.data}`;
        }
      }
      throw new Error("No image data received.");
    } catch (error: any) {
      if (error.message?.includes("Requested entity was not found")) {
        await aiStudio.openSelectKey();
        return this.generateImage(prompt, modelId, aspectRatio);
      }
      throw error;
    }
  }

  async faceSwap(faceImage: Attachment, targetImage: Attachment, additionalInstructions: string = "") {
    await this.ensureApiKey();
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

    try {
      const response = await ai.models.generateContent({
        model: MODELS.IMAGE[0].id, // Use Pro model for edits
        contents: {
          parts: [
            {
              inlineData: {
                data: faceImage.data,
                mimeType: faceImage.mimeType
              }
            },
            {
              inlineData: {
                data: targetImage.data,
                mimeType: targetImage.mimeType
              }
            },
            {
              text: `Instructions: Take the face from the first image and perfectly swap it onto the person in the second image. ${additionalInstructions}. Ensure the lighting, texture, and pose match the second image seamlessly.`
            }
          ]
        },
        config: {
          imageConfig: {
            aspectRatio: "1:1"
          }
        }
      });

      for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) {
          return `data:image/png;base64,${part.inlineData.data}`;
        }
      }
      throw new Error("Face swap failed to produce an image.");
    } catch (error: any) {
      if (error.message?.includes("Requested entity was not found")) {
        await aiStudio.openSelectKey();
        return this.faceSwap(faceImage, targetImage, additionalInstructions);
      }
      throw error;
    }
  }

  async generateVideo(prompt: string, startImage?: Attachment, aspectRatio: string = "16:9") {
    await this.ensureApiKey();
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

    try {
      const config: any = {
        numberOfVideos: 1,
        resolution: '720p',
        aspectRatio: aspectRatio as any
      };

      const payload: any = {
        model: MODELS.VIDEO_FAST.id,
        prompt: prompt || "A cinematic scene",
        config
      };

      if (startImage) {
        payload.image = {
          imageBytes: startImage.data,
          mimeType: startImage.mimeType
        };
      }

      let operation = await ai.models.generateVideos(payload);

      while (!operation.done) {
        await new Promise(resolve => setTimeout(resolve, 10000));
        operation = await ai.operations.getVideosOperation({ operation: operation });
      }

      if (operation.error) {
        throw new Error(`Video generation failed: ${operation.error.message || 'Error occurred.'}`);
      }

      const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
      if (!downloadLink) {
        throw new Error("Video generation failed: No download link.");
      }

      const response = await fetch(`${downloadLink}&key=${process.env.API_KEY}`);
      if (!response.ok) {
        throw new Error(`Failed to download video: ${response.statusText}`);
      }
      const blob = await response.blob();
      return URL.createObjectURL(blob);
    } catch (error: any) {
      if (error.message?.includes("Requested entity was not found")) {
        await aiStudio.openSelectKey();
        return this.generateVideo(prompt, startImage, aspectRatio);
      }
      throw error;
    }
  }
}
