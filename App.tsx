
import React, { useState, useRef, useEffect } from 'react';
import { AppMode, Message, Attachment } from './types';
import { ICONS, MODELS } from './constants';
import { GeminiService } from './services/geminiService';

const tg = (window as any).Telegram?.WebApp;

const ChatMessage: React.FC<{ msg: Message }> = ({ msg }) => {
  const isAI = msg.sender === 'ai';
  return (
    <div className={`flex w-full mb-4 ${isAI ? 'justify-start' : 'justify-end animate-in fade-in slide-in-from-bottom-2'}`}>
      <div className={`max-w-[90%] rounded-2xl px-4 py-2.5 shadow-md relative ${isAI ? 'bg-[#212121] border border-gray-800' : 'bg-[#2481cc]'}`}>
        {msg.attachments?.length ? (
          <div className="flex gap-2 mb-2 overflow-x-auto pb-1 no-scrollbar">
            {msg.attachments.map((a, i) => <img key={i} src={`data:${a.mimeType};base64,${a.data}`} className="w-28 h-28 object-cover rounded-xl border border-white/10" />)}
          </div>
        ) : msg.attachment && (
          <img src={`data:${msg.attachment.mimeType};base64,${msg.attachment.data}`} className="w-full rounded-xl mb-2 shadow-sm" />
        )}
        
        {msg.mediaUrl ? (
          msg.type === 'video' ? <video src={msg.mediaUrl} controls className="w-full rounded-xl" /> : <img src={msg.mediaUrl} className="w-full rounded-xl" />
        ) : msg.status === 'pending' ? (
          <div className="py-6 px-10 flex flex-col items-center gap-3">
            <div className="w-6 h-6 border-2 border-white/20 border-t-white animate-spin rounded-full"></div>
            <span className="text-[10px] font-black uppercase tracking-widest opacity-50 text-white">Banana Processing...</span>
          </div>
        ) : (
          <div className="text-[15px] leading-relaxed whitespace-pre-wrap">{msg.content}</div>
        )}
        <div className="text-[9px] text-right mt-1 opacity-40">
          {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>
    </div>
  );
};

export default function App() {
  const [activeMode, setActiveMode] = useState<AppMode>(AppMode.CHAT);
  const [hasKey, setHasKey] = useState<boolean | null>(null);
  const [chatModel, setChatModel] = useState(MODELS.CHAT[1].id);
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
  const service = GeminiService.getInstance();

  useEffect(() => {
    if (tg) {
      tg.ready();
      tg.expand();
      tg.setHeaderColor('#181818');
      tg.setBackgroundColor('#181818');
    }
    service.checkKeySelection().then(setHasKey);
  }, []);

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
    e.target.value = '';
  };

  const handleSend = async () => {
    if (isLoading) return;
    if (activeMode === AppMode.FACESWAP && (!swapFace || !swapTarget)) return;
    if (activeMode !== AppMode.FACESWAP && !input.trim() && !pendingAttachment) return;

    const currentMsg: Message = {
      id: Date.now().toString(),
      type: 'text',
      content: input || (activeMode === AppMode.FACESWAP ? "Face Swap Request" : "Generation Request"),
      sender: 'user',
      timestamp: Date.now(),
      attachment: pendingAttachment || undefined,
      attachments: activeMode === AppMode.FACESWAP ? [swapFace!, swapTarget!] : undefined
    };

    setHistories(prev => ({ ...prev, [activeMode]: [...prev[activeMode], currentMsg] }));
    setInput(''); setPendingAttachment(null);
    setIsLoading(true);

    try {
      if (activeMode === AppMode.CHAT) {
        const res = await service.sendTextMessage(currentMsg.content, chatModel, currentMsg.attachment);
        addAI(activeMode, { content: res });
      } else if (activeMode === AppMode.IMAGE) {
        const id = Date.now().toString();
        addAI(activeMode, { id, type: 'image', status: 'pending' });
        const url = await service.generateImage(currentMsg.content, imageModel);
        updateAI(activeMode, id, { mediaUrl: url, status: 'done' });
      } else if (activeMode === AppMode.FACESWAP) {
        const id = Date.now().toString();
        addAI(activeMode, { id, type: 'image', status: 'pending' });
        const url = await service.faceSwap(swapFace!, swapTarget!, input);
        updateAI(activeMode, id, { mediaUrl: url, status: 'done' });
        setSwapFace(null); setSwapTarget(null);
      } else if (activeMode === AppMode.VIDEO) {
        const id = Date.now().toString();
        addAI(activeMode, { id, type: 'video', status: 'pending' });
        const url = await service.generateVideo(currentMsg.content, currentMsg.attachment);
        updateAI(activeMode, id, { mediaUrl: url, status: 'done' });
      }
    } catch (e: any) {
      addAI(activeMode, { content: "Ошибка: " + e.message });
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

  if (hasKey === false) {
    return (
      <div className="h-screen flex flex-col items-center justify-center p-10 text-center animate-in fade-in duration-700">
        <div className="w-24 h-24 bg-yellow-500 rounded-full flex items-center justify-center mb-8 shadow-2xl animate-bounce">
          <span className="text-5xl">🍌</span>
        </div>
        <h1 className="text-3xl font-black mb-4 tracking-tighter uppercase italic">NANOBANANA</h1>
        <p className="text-gray-400 mb-10 text-sm leading-relaxed max-w-[250px]">Подключите ваш Google AI Studio ключ, чтобы активировать профессиональные модели Gemini.</p>
        <button onClick={async () => { await service.requestKey(); setHasKey(true); }} className="w-full bg-blue-600 hover:bg-blue-500 py-4.5 rounded-2xl font-bold shadow-lg active:scale-95 transition-all text-white">ПОДКЛЮЧИТЬ GOOGLE AI</button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-[#181818] overflow-hidden">
      {/* Header */}
      <header className="h-14 border-b border-gray-800 flex items-center justify-between px-4 shrink-0 bg-[#181818]/80 backdrop-blur-md z-10">
        <div className="flex items-center gap-2">
           <span className="text-xl">🍌</span>
           <div className="flex flex-col">
             <span className="text-xs font-black tracking-tight leading-none">NANOBANANA PRO</span>
             <span className="text-[8px] text-green-500 font-bold uppercase mt-0.5">Live • GPU Accelerated</span>
           </div>
        </div>
        <div className="flex gap-2">
          {(activeMode === AppMode.CHAT || activeMode === AppMode.IMAGE) && (
            <div className="bg-white/5 rounded-full p-0.5 flex">
              {(activeMode === AppMode.CHAT ? MODELS.CHAT : MODELS.IMAGE).map(m => (
                <button key={m.id} onClick={() => activeMode === AppMode.CHAT ? setChatModel(m.id) : setImageModel(m.id)} className={`px-2.5 py-1 text-[9px] font-bold rounded-full transition-all ${(activeMode === AppMode.CHAT ? chatModel : imageModel) === m.id ? 'bg-blue-600 text-white' : 'text-gray-500'}`}>
                  {m.name.split(' ').pop()}
                </button>
              ))}
            </div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {/* Navigation Bar */}
        <nav className="flex justify-around p-2 bg-[#212121] border-b border-gray-800 shrink-0">
          {[
            { mode: AppMode.CHAT, icon: <ICONS.Chat className="w-5 h-5" />, label: 'Чат' },
            { mode: AppMode.IMAGE, icon: <ICONS.Image className="w-5 h-5" />, label: 'Арт' },
            { mode: AppMode.FACESWAP, icon: <ICONS.Swap className="w-5 h-5" />, label: 'Лица' },
            { mode: AppMode.VIDEO, icon: <ICONS.Video className="w-5 h-5" />, label: 'Видео' }
          ].map(item => (
            <button key={item.mode} onClick={() => setActiveMode(item.mode)} className={`flex flex-col items-center gap-1 p-2 rounded-xl transition-all ${activeMode === item.mode ? 'text-blue-500 scale-110' : 'text-gray-500'}`}>
              {item.icon}
              <span className="text-[9px] font-bold uppercase tracking-widest">{item.label}</span>
            </button>
          ))}
        </nav>

        {/* Chat History */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-2 no-scrollbar">
          {histories[activeMode].length === 0 && (
            <div className="h-full flex flex-col items-center justify-center opacity-20">
              <span className="text-6xl mb-4">🍌</span>
              <p className="text-xs font-black tracking-[0.2em] uppercase">Ready for Input</p>
            </div>
          )}
          {histories[activeMode].map(m => <ChatMessage key={m.id} msg={m} />)}
        </div>
      </div>

      {/* Input Area */}
      <div className="p-4 bg-[#212121] border-t border-gray-800">
        <div className="max-w-2xl mx-auto">
          {activeMode === AppMode.FACESWAP && (
            <div className="flex gap-2 mb-4 animate-in slide-in-from-bottom-2">
              <div onClick={() => fileRefs.face.current?.click()} className="flex-1 aspect-square bg-[#181818] rounded-xl border border-gray-700 flex items-center justify-center overflow-hidden hover:border-blue-500 active:scale-95 transition-all">
                {swapFace ? <img src={`data:${swapFace.mimeType};base64,${swapFace.data}`} className="w-full h-full object-cover" /> : <div className="text-center"><ICONS.UserCircle className="w-6 h-6 mx-auto mb-1 text-gray-500" /><span className="text-[8px] uppercase font-bold text-gray-500">ЛИЦО</span></div>}
              </div>
              <div onClick={() => fileRefs.target.current?.click()} className="flex-1 aspect-square bg-[#181818] rounded-xl border border-gray-700 flex items-center justify-center overflow-hidden hover:border-blue-500 active:scale-95 transition-all">
                {swapTarget ? <img src={`data:${swapTarget.mimeType};base64,${swapTarget.data}`} className="w-full h-full object-cover" /> : <div className="text-center"><ICONS.Image className="w-6 h-6 mx-auto mb-1 text-gray-500" /><span className="text-[8px] uppercase font-bold text-gray-500">КУДА</span></div>}
              </div>
            </div>
          )}

          {pendingAttachment && activeMode !== AppMode.FACESWAP && (
            <div className="mb-4 relative w-20 h-20 rounded-xl overflow-hidden shadow-lg animate-in zoom-in-75">
              <img src={`data:${pendingAttachment.mimeType};base64,${pendingAttachment.data}`} className="w-full h-full object-cover" />
              <button onClick={() => setPendingAttachment(null)} className="absolute top-1 right-1 bg-black/60 p-1.5 rounded-lg"><ICONS.Close className="w-3 h-3 text-white" /></button>
            </div>
          )}

          <div className="flex items-end gap-2 bg-[#181818] rounded-2xl p-1.5 pl-3 border border-gray-700 focus-within:border-blue-500 transition-all">
            <input type="file" className="hidden" ref={fileRefs.normal} onChange={e => handleUpload(e, 'normal')} />
            <input type="file" className="hidden" ref={fileRefs.face} onChange={e => handleUpload(e, 'face')} />
            <input type="file" className="hidden" ref={fileRefs.target} onChange={e => handleUpload(e, 'target')} />
            
            {activeMode !== AppMode.FACESWAP && (
              <button onClick={() => fileRefs.normal.current?.click()} className="w-10 h-10 flex items-center justify-center text-gray-500 active:scale-90 transition-all">
                <ICONS.Attach className="w-5 h-5 rotate-45" />
              </button>
            )}

            <textarea 
              value={input} onChange={e => setInput(e.target.value)}
              placeholder={activeMode === AppMode.FACESWAP ? "Описание..." : "Сообщение..."}
              className="flex-1 bg-transparent py-2.5 outline-none text-[15px] max-h-32 resize-none"
              rows={1}
              onKeyDown={(e) => { if(e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            />
            
            <button onClick={handleSend} disabled={isLoading} className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${isLoading ? 'bg-gray-800' : 'bg-blue-600 shadow-md active:scale-90'}`}>
              {isLoading ? <div className="w-4 h-4 border-2 border-white/20 border-t-white animate-spin rounded-full" /> : <ICONS.Send className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
