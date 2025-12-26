
export type MessageType = 'text' | 'image' | 'video' | 'system';

export interface Attachment {
  data: string; // base64
  mimeType: string;
}

export interface Message {
  id: string;
  type: MessageType;
  content: string;
  sender: 'user' | 'ai';
  timestamp: number;
  mediaUrl?: string;
  attachment?: Attachment;
  attachments?: Attachment[];
  status?: 'pending' | 'done' | 'error';
}

export enum AppMode {
  CHAT = 'CHAT',
  IMAGE = 'IMAGE',
  VIDEO = 'VIDEO',
  FACESWAP = 'FACESWAP'
}

export interface GenerationParams {
  prompt: string;
  aspectRatio?: '1:1' | '16:9' | '9:16' | '4:3' | '3:4';
  resolution?: '720p' | '1080p';
  imageSize?: '1K' | '2K' | '4K';
}
