
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
    if (aiStudio && typeof aiStudio.hasSelectedApiKey === 'function') {
      const hasKey = await aiStudio.hasSelectedApiKey();
      if (!hasKey) {
        await aiStudio.openSelectKey();
      }
    }
  }

  private getAI() {
    return new GoogleGenAI({ apiKey: process.env.API_KEY });
  }

  async sendTextMessage(prompt: string, modelId: string, attachment?: Attachment) {
    await this.ensureApiKey();
    const ai = this.getAI();
    
    const parts: any[] = [{ text: prompt }];
    if (attachment) {
      parts.push({
        inlineData: {
          data: attachment.data,
          mimeType: attachment.mimeType
        }
      });
    }

    try {
      const response = await ai.models.generateContent({
        model: modelId,
        contents: { parts },
        config: {
          systemInstruction: "You are a versatile AI assistant living inside a Telegram Mini App. You are powered by Google Gemini. Use Markdown for formatting. Be concise and friendly.",
        }
      });
      return response.text;
    } catch (error: any) {
      if (error.message?.includes("Requested entity was not found") && aiStudio) {
        await aiStudio.openSelectKey();
      }
      throw error;
    }
  }

  async generateImage(prompt: string, modelId: string, aspectRatio: string = "1:1") {
    await this.ensureApiKey();
    const ai = this.getAI();
    
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
      if (error.message?.includes("Requested entity was not found") && aiStudio) {
        await aiStudio.openSelectKey();
      }
      throw error;
    }
  }

  async faceSwap(faceImage: Attachment, targetImage: Attachment, instructions: string = "") {
    await this.ensureApiKey();
    const ai = this.getAI();

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3-pro-image-preview', // Best for editing
        contents: {
          parts: [
            { inlineData: { data: faceImage.data, mimeType: faceImage.mimeType } },
            { inlineData: { data: targetImage.data, mimeType: targetImage.mimeType } },
            { text: `Task: Take the face from the first image and place it onto the person in the second image. ${instructions}. Match lighting and style. Return the edited image.` }
          ]
        },
        config: {
          imageConfig: { aspectRatio: "1:1" }
        }
      });

      for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) {
          return `data:image/png;base64,${part.inlineData.data}`;
        }
      }
      throw new Error("Face swap failed.");
    } catch (error: any) {
      if (error.message?.includes("Requested entity was not found") && aiStudio) {
        await aiStudio.openSelectKey();
      }
      throw error;
    }
  }

  async generateVideo(prompt: string, startImage?: Attachment) {
    await this.ensureApiKey();
    const ai = this.getAI();

    try {
      let operation = await ai.models.generateVideos({
        model: 'veo-3.1-fast-generate-preview',
        prompt: prompt || "Cinematic shot",
        image: startImage ? {
          imageBytes: startImage.data,
          mimeType: startImage.mimeType
        } : undefined,
        config: { numberOfVideos: 1, resolution: '720p', aspectRatio: '16:9' }
      });

      while (!operation.done) {
        await new Promise(resolve => setTimeout(resolve, 10000));
        operation = await ai.operations.getVideosOperation({ operation: operation });
      }

      const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
      const response = await fetch(`${downloadLink}&key=${process.env.API_KEY}`);
      const blob = await response.blob();
      return URL.createObjectURL(blob);
    } catch (error: any) {
      if (error.message?.includes("Requested entity was not found") && aiStudio) {
        await aiStudio.openSelectKey();
      }
      throw error;
    }
  }
}
