
import React, { useState, useRef, useEffect } from 'react';
import { AppMode, Message, Attachment } from './types';
import { ICONS, MODELS } from './constants';
import { GeminiService } from './services/geminiService';

const tg = (window as any).Telegram?.WebApp;

const SidebarItem: React.FC<{ 
  mode: AppMode, 
  title: string, 
  subtitle: string, 
  active: boolean, 
  onClick: () => void 
}> = ({ mode, title, subtitle, active, onClick }) => {
  const getAvatarColor = () => {
    switch(mode) {
      case AppMode.CHAT: return 'bg-blue-500';
      case AppMode.IMAGE: return 'bg-yellow-500';
      case AppMode.VIDEO: return 'bg-purple-500';
      case AppMode.FACESWAP: return 'bg-pink-500';
    }
  };

  return (
    <div 
      onClick={onClick}
      className={`flex items-center p-3 cursor-pointer transition-all ${active ? 'bg-[#2b5278]' : 'hover:bg-[#2c2c2c]'}`}
    >
      <div className={`w-10 h-10 md:w-12 md:h-12 rounded-full ${getAvatarColor()} flex items-center justify-center text-white shrink-0 shadow-sm`}>
        {mode === AppMode.CHAT && <ICONS.Chat className="w-5 h-5 md:w-6 md:h-6" />}
        {mode === AppMode.IMAGE && <ICONS.Image className="w-5 h-5 md:w-6 md:h-6" />}
        {mode === AppMode.VIDEO && <ICONS.Video className="w-5 h-5 md:w-6 md:h-6" />}
        {mode === AppMode.FACESWAP && <ICONS.Swap className="w-5 h-5 md:w-6 md:h-6" />}
      </div>
      <div className="ml-3 hidden md:block overflow-hidden">
        <div className="font-semibold text-[15px] truncate">{title}</div>
        <p className="text-[12px] text-gray-400 truncate">{subtitle}</p>
      </div>
    </div>
  );
};

const ChatMessage: React.FC<{ msg: Message }> = ({ msg }) => {
  const isAI = msg.sender === 'ai';
  return (
    <div className={`flex w-full mb-4 ${isAI ? 'justify-start' : 'justify-end'}`}>
      <div className={`max-w-[85%] rounded-2xl px-3.5 py-2 shadow-sm ${isAI ? 'bg-[#212121] border border-gray-800' : 'bg-[#2b5278]'}`}>
        {msg.attachments && (
          <div className="flex gap-1 mb-2">
            {msg.attachments.map((a, i) => (
              <img key={i} src={`data:${a.mimeType};base64,${a.data}`} className="w-20 h-20 object-cover rounded-lg" />
            ))}
          </div>
        )}
        {msg.attachment && !msg.attachments && (
           <img src={`data:${msg.attachment.mimeType};base64,${msg.attachment.data}`} className="w-full rounded-lg mb-2" />
        )}
        {msg.mediaUrl ? (
          msg.type === 'video' ? <video src={msg.mediaUrl} controls className="w-full rounded-lg" /> : <img src={msg.mediaUrl} className="w-full rounded-lg" />
        ) : msg.status === 'pending' ? (
          <div className="p-4 text-center text-gray-400 animate-pulse">Processing magic...</div>
        ) : (
          <p className="text-[15px] leading-relaxed whitespace-pre-wrap">{msg.content}</p>
        )}
      </div>
    </div>
  );
};

export default function App() {
  const [activeMode, setActiveMode] = useState<AppMode>(AppMode.CHAT);
  const [chatModel, setChatModel] = useState(MODELS.CHAT[0].id);
  const [imageModel, setImageModel] = useState(MODELS.IMAGE[0].id);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [swapFace, setSwapFace] = useState<Attachment | null>(null);
  const [swapTarget, setSwapTarget] = useState<Attachment | null>(null);
  const [pendingAttachment, setPendingAttachment] = useState<Attachment | null>(null);

  const [histories, setHistories] = useState<Record<AppMode, Message[]>>({
    [AppMode.CHAT]: [], [AppMode.IMAGE]: [], [AppMode.VIDEO]: [], [AppMode.FACESWAP]: []
  });

  const scrollRef = useRef<HTMLDivElement>(null);
  const fileRefs = { normal: useRef<HTMLInputElement>(null), face: useRef<HTMLInputElement>(null), target: useRef<HTMLInputElement>(null) };

  useEffect(() => { tg?.ready(); tg?.expand(); }, []);
  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, [histories, activeMode]);

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>, type: 'normal' | 'face' | 'target') => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const base64 = (ev.target?.result as string).split(',')[1];
      const att = { data: base64, mimeType: file.type };
      if (type === 'normal') setPendingAttachment(att);
      else if (type === 'face') setSwapFace(att);
      else setSwapTarget(att);
    };
    reader.readAsDataURL(file);
  };

  const handleSend = async () => {
    if (isLoading) return;
    const currentMsg: Message = {
      id: Date.now().toString(),
      type: 'text',
      content: input || (activeMode === AppMode.FACESWAP ? "Swapping faces..." : "Processing image..."),
      sender: 'user',
      timestamp: Date.now(),
      attachment: pendingAttachment || undefined,
      attachments: activeMode === AppMode.FACESWAP && swapFace && swapTarget ? [swapFace, swapTarget] : undefined
    };

    setHistories(prev => ({ ...prev, [activeMode]: [...prev[activeMode], currentMsg] }));
    setInput(''); setPendingAttachment(null);
    if (activeMode === AppMode.FACESWAP) { setSwapFace(null); setSwapTarget(null); }
    setIsLoading(true);

    try {
      const service = GeminiService.getInstance();
      if (activeMode === AppMode.CHAT) {
        const res = await service.sendTextMessage(currentMsg.content, chatModel, currentMsg.attachment);
        addAI(activeMode, { content: res });
      } else if (activeMode === AppMode.IMAGE) {
        const id = Date.now().toString();
        addAI(activeMode, { id, type: 'image', status: 'pending', content: currentMsg.content });
        const url = await service.generateImage(currentMsg.content, imageModel);
        updateAI(activeMode, id, { mediaUrl: url, status: 'done' });
      } else if (activeMode === AppMode.FACESWAP) {
        const id = Date.now().toString();
        addAI(activeMode, { id, type: 'image', status: 'pending' });
        const url = await service.faceSwap(currentMsg.attachments![0], currentMsg.attachments![1], input);
        updateAI(activeMode, id, { mediaUrl: url, status: 'done' });
      } else if (activeMode === AppMode.VIDEO) {
        const id = Date.now().toString();
        addAI(activeMode, { id, type: 'video', status: 'pending', content: currentMsg.content });
        const url = await service.generateVideo(currentMsg.content, currentMsg.attachment);
        updateAI(activeMode, id, { mediaUrl: url, status: 'done' });
      }
    } catch (e: any) {
      addAI(activeMode, { content: "Error: " + e.message });
    } finally {
      setIsLoading(false);
    }
  };

  const addAI = (mode: AppMode, data: Partial<Message>) => {
    setHistories(prev => ({ ...prev, [mode]: [...prev[mode], { id: Date.now().toString(), sender: 'ai', timestamp: Date.now(), type: 'text', content: '', ...data } as Message] }));
  };

  const updateAI = (mode: AppMode, id: string, data: Partial<Message>) => {
    setHistories(prev => ({ ...prev, [mode]: prev[mode].map(m => m.id === id ? { ...m, ...data } : m) }));
  };

  return (
    <div className="flex h-screen bg-[#181818] text-white">
      <div className="w-[60px] md:w-[280px] bg-[#212121] border-r border-gray-800 flex flex-col">
        <div className="h-14 flex items-center justify-center md:justify-start px-4 border-b border-gray-800 font-bold text-blue-500">AI</div>
        <SidebarItem mode={AppMode.CHAT} title="Chat" subtitle="Gemini 3" active={activeMode === AppMode.CHAT} onClick={() => setActiveMode(AppMode.CHAT)} />
        <SidebarItem mode={AppMode.IMAGE} title="Nano Pro" subtitle="Image Gen" active={activeMode === AppMode.IMAGE} onClick={() => setActiveMode(AppMode.IMAGE)} />
        <SidebarItem mode={AppMode.FACESWAP} title="Face Swap" subtitle="Face Edit" active={activeMode === AppMode.FACESWAP} onClick={() => setActiveMode(AppMode.FACESWAP)} />
        <SidebarItem mode={AppMode.VIDEO} title="Veo 3" subtitle="Video Maker" active={activeMode === AppMode.VIDEO} onClick={() => setActiveMode(AppMode.VIDEO)} />
      </div>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 bg-[#212121] border-b border-gray-800 flex items-center justify-between px-4">
          <span className="font-semibold truncate">{activeMode} Bot</span>
          <div className="flex gap-1">
            {activeMode === AppMode.CHAT && MODELS.CHAT.map(m => <button key={m.id} onClick={() => setChatModel(m.id)} className={`px-2 py-1 text-[10px] rounded-full ${chatModel === m.id ? 'bg-blue-600' : 'bg-gray-800'}`}>{m.name.split(' ').pop()}</button>)}
            {activeMode === AppMode.IMAGE && MODELS.IMAGE.map(m => <button key={m.id} onClick={() => setImageModel(m.id)} className={`px-2 py-1 text-[10px] rounded-full ${imageModel === m.id ? 'bg-blue-600' : 'bg-gray-800'}`}>{m.name.split(' ').pop()}</button>)}
          </div>
        </header>

        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-2">
          {histories[activeMode].map(m => <ChatMessage key={m.id} msg={m} />)}
        </div>

        <div className="p-4 bg-[#212121] border-t border-gray-800">
          {activeMode === AppMode.FACESWAP && (
            <div className="flex gap-2 mb-3">
              <div onClick={() => fileRefs.face.current?.click()} className="flex-1 h-20 bg-gray-800 rounded-lg border-2 border-dashed border-gray-700 flex items-center justify-center cursor-pointer overflow-hidden">
                {swapFace ? <img src={`data:${swapFace.mimeType};base64,${swapFace.data}`} className="w-full h-full object-cover" /> : <span className="text-[10px]">Load Face</span>}
              </div>
              <div onClick={() => fileRefs.target.current?.click()} className="flex-1 h-20 bg-gray-800 rounded-lg border-2 border-dashed border-gray-700 flex items-center justify-center cursor-pointer overflow-hidden">
                {swapTarget ? <img src={`data:${swapTarget.mimeType};base64,${swapTarget.data}`} className="w-full h-full object-cover" /> : <span className="text-[10px]">Load Target</span>}
              </div>
            </div>
          )}

          <div className="flex items-end gap-2 max-w-4xl mx-auto">
            <input type="file" className="hidden" ref={fileRefs.normal} onChange={e => handleUpload(e, 'normal')} />
            <input type="file" className="hidden" ref={fileRefs.face} onChange={e => handleUpload(e, 'face')} />
            <input type="file" className="hidden" ref={fileRefs.target} onChange={e => handleUpload(e, 'target')} />
            
            {activeMode !== AppMode.FACESWAP && (
              <button onClick={() => fileRefs.normal.current?.click()} className="p-2 text-gray-400 hover:text-white"><ICONS.Attach className="w-6 h-6" /></button>
            )}

            <textarea 
              value={input} onChange={e => setInput(e.target.value)}
              placeholder="Type here..."
              className="flex-1 bg-gray-800 rounded-xl p-3 resize-none outline-none text-sm max-h-32"
              rows={1}
            />
            <button onClick={handleSend} disabled={isLoading} className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center shrink-0">
              {isLoading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white animate-spin rounded-full" /> : <ICONS.Send className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
