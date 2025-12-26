
import React from 'react';

export const MODELS = {
  CHAT: [
    { id: 'gemini-3-flash-preview', name: 'Gemini 3 Flash', label: 'Fast & Lightweight' },
    { id: 'gemini-3-pro-preview', name: 'Gemini 3 Pro', label: 'Smart & Complex' }
  ],
  IMAGE: [
    { id: 'gemini-3-pro-image-preview', name: 'Nano Banana Pro', label: 'Highest Quality' },
    { id: 'gemini-2.5-flash-image', name: 'Nano Banana', label: 'Fast Generation' }
  ],
  VIDEO: { id: 'veo-3.1-generate-preview', name: 'Veo 3 Cinema' },
  VIDEO_FAST: { id: 'veo-3.1-fast-generate-preview', name: 'Veo 3 Fast' }
};

export const UI_COLORS = {
  primary: '#2481cc',
  bgDark: '#212121',
  bgDarker: '#181818',
  bgBubbleUser: '#2b5278',
  bgBubbleAI: '#212121',
  textSecondary: '#aaaaaa'
};

export const ICONS = {
  Send: (props: any) => (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
    </svg>
  ),
  Image: (props: any) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <polyline points="21 15 16 10 5 21" />
    </svg>
  ),
  Video: (props: any) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <polygon points="23 7 16 12 23 17 23 7" />
      <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
    </svg>
  ),
  Chat: (props: any) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 1 1-7.6-11.7 8.38 8.38 0 0 1 3.8.9L21 3z" />
    </svg>
  ),
  Attach: (props: any) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
    </svg>
  ),
  Close: (props: any) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  ),
  Swap: (props: any) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <path d="M16 3l4 4-4 4" />
      <path d="M20 7H4" />
      <path d="M8 21l-4-4 4-4" />
      <path d="M4 17h16" />
    </svg>
  ),
  UserCircle: (props: any) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  )
};
