
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

  async checkKeySelection(): Promise<boolean> {
    if (aiStudio && typeof aiStudio.hasSelectedApiKey === 'function') {
      return await aiStudio.hasSelectedApiKey();
    }
    return true; 
  }

  async requestKey(): Promise<void> {
    if (aiStudio && typeof aiStudio.openSelectKey === 'function') {
      await aiStudio.openSelectKey();
    }
  }

  private getAI() {
    // В AI Studio ключ инжектируется автоматически. 
    // Всегда создаем новый экземпляр перед вызовом для актуальности ключа.
    return new GoogleGenAI({ apiKey: process.env.API_KEY });
  }

  async sendTextMessage(prompt: string, modelId: string, attachment?: Attachment) {
    const ai = this.getAI();
    const parts: any[] = [{ text: prompt }];
    if (attachment) {
      parts.push({
        inlineData: { data: attachment.data, mimeType: attachment.mimeType }
      });
    }

    try {
      const isPro = modelId.includes('pro');
      const response = await ai.models.generateContent({
        model: modelId,
        contents: { parts },
        config: {
          systemInstruction: "You are 'NANOBANANA PRO', a top-tier AI assistant. You can browse the web, generate images and videos. Be helpful, concise, and professional.",
          // Включаем поиск Google только для Pro модели
          tools: isPro ? [{ googleSearch: {} }] : undefined,
        }
      });

      let text = response.text || "";
      
      // Добавляем источники, если использовался поиск
      const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
      if (chunks && chunks.length > 0) {
        text += "\n\n**Источники:**";
        const urls = new Set<string>();
        chunks.forEach((chunk: any) => {
          if (chunk.web?.uri) urls.add(chunk.web.uri);
        });
        urls.forEach(url => {
          text += `\n- [${new URL(url).hostname}](${url})`;
        });
      }

      return text;
    } catch (error: any) {
      console.error("Gemini API Error:", error);
      if (error.message?.includes("Requested entity was not found")) {
        await this.requestKey();
      }
      throw error;
    }
  }

  async generateImage(prompt: string, modelId: string) {
    const ai = this.getAI();
    try {
      const response = await ai.models.generateContent({
        model: modelId,
        contents: { parts: [{ text: prompt }] },
        config: {
          imageConfig: { aspectRatio: "1:1", imageSize: "1K" }
        }
      });

      for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) return `data:image/png;base64,${part.inlineData.data}`;
      }
      throw new Error("Изображение не получено от нейросети.");
    } catch (error: any) {
      if (error.message?.includes("Requested entity was not found")) {
        await this.requestKey();
      }
      throw error;
    }
  }

  async faceSwap(face: Attachment, target: Attachment, prompt: string) {
    const ai = this.getAI();
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3-pro-image-preview',
        contents: {
          parts: [
            { inlineData: { data: face.data, mimeType: face.mimeType } },
            { inlineData: { data: target.data, mimeType: target.mimeType } },
            { text: `Face Swap: Blend the face from image 1 onto the head of the person in image 2. ${prompt}` }
          ]
        },
        config: { imageConfig: { aspectRatio: "1:1" } }
      });
      for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) return `data:image/png;base64,${part.inlineData.data}`;
      }
      throw new Error("Замена лица не удалась.");
    } catch (error: any) {
      if (error.message?.includes("Requested entity was not found")) await this.requestKey();
      throw error;
    }
  }

  async generateVideo(prompt: string, image?: Attachment) {
    const ai = this.getAI();
    try {
      let op = await ai.models.generateVideos({
        model: 'veo-3.1-fast-generate-preview',
        prompt: prompt || "Cinematic shot",
        image: image ? { imageBytes: image.data, mimeType: image.mimeType } : undefined,
        config: { numberOfVideos: 1, resolution: '720p', aspectRatio: '16:9' }
      });

      while (!op.done) {
        await new Promise(r => setTimeout(r, 10000));
        op = await ai.operations.getVideosOperation({ operation: op });
      }

      const link = op.response?.generatedVideos?.[0]?.video?.uri;
      const res = await fetch(`${link}&key=${process.env.API_KEY}`);
      const blob = await res.blob();
      return URL.createObjectURL(blob);
    } catch (error: any) {
      if (error.message?.includes("Requested entity was not found")) {
        await this.requestKey();
      }
      throw error;
    }
  }
}
