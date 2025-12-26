
import React, { useState, useRef, useEffect } from 'react';
import { AppMode, Message, Attachment } from './types';
import { ICONS, MODELS } from './constants';
import { GeminiService } from './services/geminiService';

// Telegram WebApp global object
const tg = (window as any).Telegram?.WebApp;

const SidebarItem: React.FC<{ 
  mode: AppMode, 
  title: string, 
  subtitle: string, 
  active: boolean, 
  onClick: () => void 
}> = ({ mode, title, subtitle, active, onClick }) => {
  const getIcon = () => {
    switch(mode) {
      case AppMode.CHAT: return <ICONS.Chat className="w-6 h-6" />;
      case AppMode.IMAGE: return <ICONS.Image className="w-6 h-6" />;
      case AppMode.VIDEO: return <ICONS.Video className="w-6 h-6" />;
      case AppMode.FACESWAP: return <ICONS.Swap className="w-6 h-6" />;
    }
  };

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
      className={`flex items-center p-3 cursor-pointer transition-colors ${active ? 'bg-[#2b5278]' : 'hover:bg-[#2c2c2c]'}`}
    >
      <div className={`w-12 h-12 rounded-full ${getAvatarColor()} flex items-center justify-center text-white shrink-0 shadow-md`}>
        {getIcon()}
      </div>
      <div className="ml-3 overflow-hidden">
        <div className="flex justify-between items-baseline">
          <span className="font-semibold text-[15px] truncate">{title}</span>
        </div>
        <p className="text-[13px] text-gray-400 truncate">{subtitle}</p>
      </div>
    </div>
  );
};

const ChatMessage: React.FC<{ msg: Message }> = ({ msg }) => {
  const isAI = msg.sender === 'ai';
  return (
    <div className={`flex w-full mb-4 ${isAI ? 'justify-start' : 'justify-end'}`}>
      <div 
        className={`max-w-[85%] rounded-2xl px-3.5 py-2 shadow-sm overflow-hidden ${
          isAI 
            ? 'bg-[#212121] text-white rounded-bl-sm border border-gray-800' 
            : 'bg-[#2b5278] text-white rounded-br-sm'
        }`}
      >
        {msg.attachment && (
          <div className="mb-2">
            <img 
              src={`data:${msg.attachment.mimeType};base64,${msg.attachment.data}`} 
              className="max-w-full rounded-lg border border-white/10" 
              alt="Uploaded Content" 
            />
          </div>
        )}
        {msg.attachments && msg.attachments.length > 0 && (
          <div className="flex gap-2 mb-2 overflow-x-auto">
            {msg.attachments.map((att, idx) => (
              <img 
                key={idx}
                src={`data:${att.mimeType};base64,${att.data}`} 
                className="w-24 h-24 object-cover rounded-lg border border-white/10" 
                alt="Uploaded Content" 
              />
            ))}
          </div>
        )}
        {msg.type === 'text' && (
          <p className="text-[15px] leading-relaxed whitespace-pre-wrap">{msg.content}</p>
        )}
        {(msg.type === 'image' || msg.type === 'video') && (
          <div className="space-y-2 min-w-[240px]">
            {msg.mediaUrl ? (
              msg.type === 'image' ? (
                <img src={msg.mediaUrl} className="w-full rounded-lg" alt="Generated" />
              ) : (
                <video src={msg.mediaUrl} controls className="w-full rounded-lg" />
              )
            ) : (
              <div className="aspect-square w-full bg-gray-800 animate-pulse rounded-lg flex items-center justify-center text-center p-4">
                <span className="text-xs text-gray-500">Creating magic...</span>
              </div>
            )}
            <p className="text-xs text-gray-400 italic">Prompt: {msg.content}</p>
          </div>
        )}
        <div className={`text-[10px] mt-1 flex justify-end ${isAI ? 'text-gray-500' : 'text-blue-200/60'}`}>
          {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>
    </div>
  );
};

export default function App() {
  const [activeMode, setActiveMode] = useState<AppMode>(AppMode.CHAT);
  const [chatModel, setChatModel] = useState(MODELS.CHAT[0].id);
  const [imageModel, setImageModel] = useState(MODELS.IMAGE[0].id);
  
  // Get Telegram User Info
  const user = tg?.initDataUnsafe?.user;
  const userName = user?.first_name || 'Friend';

  const [chatHistories, setChatHistories] = useState<Record<AppMode, Message[]>>({
    [AppMode.CHAT]: [{ id: 'w1', type: 'text', content: `Hello ${userName}! Gemini Chat is ready. I'm powered by Flash and Pro models.`, sender: 'ai', timestamp: Date.now() }],
    [AppMode.IMAGE]: [{ id: 'w2', type: 'text', content: 'Nano Banana Pro image generation is ready. Describe anything!', sender: 'ai', timestamp: Date.now() }],
    [AppMode.VIDEO]: [{ id: 'w3', type: 'text', content: 'Veo 3 Cinema is online. Send a prompt to create video.', sender: 'ai', timestamp: Date.now() }],
    [AppMode.FACESWAP]: [{ id: 'w4', type: 'text', content: 'Face Swap active. Upload a source face and a target image.', sender: 'ai', timestamp: Date.now() }]
  });
  
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [pendingAttachment, setPendingAttachment] = useState<Attachment | null>(null);
  const [swapFace, setSwapFace] = useState<Attachment | null>(null);
  const [swapTarget, setSwapTarget] = useState<Attachment | null>(null);
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const faceInputRef = useRef<HTMLInputElement>(null);
  const targetInputRef = useRef<HTMLInputElement>(null);
  const gemini = GeminiService.getInstance();

  useEffect(() => {
    // Initialize Telegram WebApp
    if (tg) {
      tg.ready();
      tg.expand();
      tg.setHeaderColor('#212121');
    }
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [chatHistories, activeMode]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, type: 'normal' | 'face' | 'target' = 'normal') => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      const base64Data = result.split(',')[1];
      const attachment = { data: base64Data, mimeType: file.type };
      if (type === 'normal') setPendingAttachment(attachment);
      else if (type === 'face') setSwapFace(attachment);
      else if (type === 'target') setSwapTarget(attachment);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleSend = async () => {
    const needsSwapInputs = activeMode === AppMode.FACESWAP && (!swapFace || !swapTarget);
    const needsNormalInputs = activeMode !== AppMode.FACESWAP && !input.trim() && !pendingAttachment;
    
    if (isLoading || needsSwapInputs || needsNormalInputs) return;

    const currentPrompt = input;
    const currentAttachment = pendingAttachment;
    const currentFace = swapFace;
    const currentTarget = swapTarget;

    const userMsg: Message = {
      id: Date.now().toString(),
      type: 'text',
      content: currentPrompt || (activeMode === AppMode.FACESWAP ? "Swapping faces..." : "Processing..."),
      sender: 'user',
      timestamp: Date.now(),
      attachment: activeMode === AppMode.FACESWAP ? undefined : (currentAttachment || undefined),
      attachments: activeMode === AppMode.FACESWAP ? [currentFace!, currentTarget!] : undefined
    };

    setChatHistories(prev => ({ ...prev, [activeMode]: [...prev[activeMode], userMsg] }));
    setInput('');
    setPendingAttachment(null);
    setSwapFace(null);
    setSwapTarget(null);
    setIsLoading(true);

    try {
      if (activeMode === AppMode.CHAT) {
        const reply = await gemini.sendTextMessage(currentPrompt || "What is in this image?", chatModel, currentAttachment || undefined);
        addAIMessage(activeMode, { type: 'text', content: reply });
      } else if (activeMode === AppMode.IMAGE) {
        const placeholderId = (Date.now() + 1).toString();
        addAIMessage(activeMode, { id: placeholderId, type: 'image', content: currentPrompt, status: 'pending' });
        const imageUrl = await gemini.generateImage(currentPrompt, imageModel);
        updateAIMessage(activeMode, placeholderId, { mediaUrl: imageUrl, status: 'done' });
      } else if (activeMode === AppMode.VIDEO) {
        const placeholderId = (Date.now() + 1).toString();
        addAIMessage(activeMode, { id: placeholderId, type: 'video', content: currentPrompt, status: 'pending' });
        const videoUrl = await gemini.generateVideo(currentPrompt, currentAttachment || undefined);
        updateAIMessage(activeMode, placeholderId, { mediaUrl: videoUrl, status: 'done' });
      } else if (activeMode === AppMode.FACESWAP) {
        const placeholderId = (Date.now() + 1).toString();
        addAIMessage(activeMode, { id: placeholderId, type: 'image', content: `Swapping faces... ${currentPrompt}`, status: 'pending' });
        const resultUrl = await gemini.faceSwap(currentFace!, currentTarget!, currentPrompt);
        updateAIMessage(activeMode, placeholderId, { mediaUrl: resultUrl, status: 'done' });
      }
    } catch (error: any) {
      addAIMessage(activeMode, { type: 'text', content: `Error: ${error.message || 'Error occurred.'}` });
    } finally {
      setIsLoading(false);
    }
  };

  const addAIMessage = (mode: AppMode, data: Partial<Message>) => {
    setChatHistories(prev => ({
      ...prev,
      [mode]: [...prev[mode], { id: Date.now().toString(), type: 'text', sender: 'ai', timestamp: Date.now(), ...data } as Message]
    }));
  };

  const updateAIMessage = (mode: AppMode, id: string, data: Partial<Message>) => {
    setChatHistories(prev => ({ ...prev, [mode]: prev[mode].map(m => m.id === id ? { ...m, ...data } : m) }));
  };

  return (
    <div className="flex h-screen bg-[#181818] overflow-hidden text-white">
      {/* Sidebar */}
      <div className="w-[80px] md:w-[300px] bg-[#212121] border-r border-gray-800 flex flex-col shrink-0">
        <div className="h-[56px] flex items-center px-4 border-b border-gray-800 shrink-0">
          <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center font-bold text-xs md:mr-3 shadow-lg">AI</div>
          <span className="hidden md:block font-semibold tracking-tight">Telegram AI Pro</span>
        </div>
        
        <div className="flex-1 overflow-y-auto">
          <SidebarItem mode={AppMode.CHAT} title="Gemini Chat" subtitle="Flash & Pro" active={activeMode === AppMode.CHAT} onClick={() => setActiveMode(AppMode.CHAT)} />
          <SidebarItem mode={AppMode.IMAGE} title="Nano Banana" subtitle="Generation" active={activeMode === AppMode.IMAGE} onClick={() => setActiveMode(AppMode.IMAGE)} />
          <SidebarItem mode={AppMode.VIDEO} title="Veo 3 Cinema" subtitle="Video Maker" active={activeMode === AppMode.VIDEO} onClick={() => setActiveMode(AppMode.VIDEO)} />
          <SidebarItem mode={AppMode.FACESWAP} title="Face Swap" subtitle="Face Editing" active={activeMode === AppMode.FACESWAP} onClick={() => setActiveMode(AppMode.FACESWAP)} />
        </div>

        <div className="p-4 border-t border-gray-800 hidden md:block">
           <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-700 flex items-center justify-center font-bold text-sm">
                {userName.charAt(0)}
              </div>
              <div className="overflow-hidden">
                <p className="text-sm font-medium truncate">{userName}</p>
                <p className="text-[10px] text-gray-500 uppercase">Premium AI Suite</p>
              </div>
           </div>
        </div>
      </div>

      {/* Main Area */}
      <div className="flex-1 flex flex-col relative">
        <header className="h-[56px] bg-[#212121] border-b border-gray-800 flex items-center justify-between px-5 shrink-0 z-10 shadow-sm">
          <div className="flex flex-col">
            <h1 className="font-semibold text-[16px] leading-tight">
              {activeMode === AppMode.CHAT ? 'Gemini Chat' : activeMode === AppMode.IMAGE ? 'Nano Banana' : activeMode === AppMode.VIDEO ? 'Veo 3' : 'Face Swap'}
            </h1>
            <p className="text-[12px] text-blue-400">bot • online</p>
          </div>

          {/* Model Switchers */}
          <div className="flex gap-2">
            {activeMode === AppMode.CHAT && (
              <div className="flex bg-[#2c2c2c] rounded-full p-1 border border-gray-700">
                {MODELS.CHAT.map(m => (
                  <button key={m.id} onClick={() => setChatModel(m.id)} className={`px-2 md:px-3 py-1 text-[10px] md:text-[11px] rounded-full transition-all ${chatModel === m.id ? 'bg-[#2481cc] text-white' : 'text-gray-400 hover:text-white'}`}>
                    {m.name.split(' ').pop()}
                  </button>
                ))}
              </div>
            )}
            {activeMode === AppMode.IMAGE && (
              <div className="flex bg-[#2c2c2c] rounded-full p-1 border border-gray-700">
                {MODELS.IMAGE.map(m => (
                  <button key={m.id} onClick={() => setImageModel(m.id)} className={`px-2 md:px-3 py-1 text-[10px] md:text-[11px] rounded-full transition-all ${imageModel === m.id ? 'bg-[#2481cc] text-white' : 'text-gray-400 hover:text-white'}`}>
                    {m.name.split(' ').pop()}
                  </button>
                ))}
              </div>
            )}
          </div>
        </header>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-6 bg-[#181818] bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] bg-opacity-5">
          <div className="max-w-3xl mx-auto">
            {chatHistories[activeMode].map((msg) => (
              <ChatMessage key={msg.id} msg={msg} />
            ))}
          </div>
        </div>

        {/* Input Area */}
        <div className="p-4 bg-[#212121] border-t border-gray-800 shrink-0">
          <div className="max-w-3xl mx-auto">
            
            {/* Special Upload Windows for Face Swap */}
            {activeMode === AppMode.FACESWAP && (
              <div className="flex gap-4 mb-4">
                <div onClick={() => faceInputRef.current?.click()} className="flex-1 aspect-video bg-[#2c2c2c] border-2 border-dashed border-gray-600 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:border-[#2481cc] transition-all relative overflow-hidden group">
                  {swapFace ? (
                    <img src={`data:${swapFace.mimeType};base64,${swapFace.data}`} className="w-full h-full object-cover" alt="Face" />
                  ) : (
                    <>
                      <ICONS.UserCircle className="w-8 h-8 text-gray-500 mb-2" />
                      <span className="text-[11px] font-medium text-gray-400">Source Face</span>
                    </>
                  )}
                </div>
                <div onClick={() => targetInputRef.current?.click()} className="flex-1 aspect-video bg-[#2c2c2c] border-2 border-dashed border-gray-600 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:border-[#2481cc] transition-all relative overflow-hidden group">
                  {swapTarget ? (
                    <img src={`data:${swapTarget.mimeType};base64,${swapTarget.data}`} className="w-full h-full object-cover" alt="Target" />
                  ) : (
                    <>
                      <ICONS.Image className="w-8 h-8 text-gray-500 mb-2" />
                      <span className="text-[11px] font-medium text-gray-400">Target Image</span>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Standard Attachment Preview */}
            {activeMode !== AppMode.FACESWAP && pendingAttachment && (
              <div className="mb-4 relative w-20 h-20 rounded-lg overflow-hidden border border-gray-600">
                <img src={`data:${pendingAttachment.mimeType};base64,${pendingAttachment.data}`} className="w-full h-full object-cover" alt="Preview" />
                <button onClick={() => setPendingAttachment(null)} className="absolute top-0 right-0 bg-black/60 p-0.5 rounded-bl hover:bg-black"><ICONS.Close className="w-4 h-4" /></button>
              </div>
            )}

            <div className="relative flex items-end gap-3">
              <input type="file" accept="image/*" ref={fileInputRef} className="hidden" onChange={(e) => handleFileUpload(e, 'normal')} />
              <input type="file" accept="image/*" ref={faceInputRef} className="hidden" onChange={(e) => handleFileUpload(e, 'face')} />
              <input type="file" accept="image/*" ref={targetInputRef} className="hidden" onChange={(e) => handleFileUpload(e, 'target')} />
              
              {activeMode !== AppMode.FACESWAP && (
                <button onClick={() => fileInputRef.current?.click()} className="w-10 h-10 rounded-full flex items-center justify-center text-gray-400 hover:text-white hover:bg-gray-700 transition-colors shrink-0 mb-1 shadow-md">
                  <ICONS.Attach className="w-6 h-6 rotate-45" />
                </button>
              )}

              <div className="flex-1 bg-[#2c2c2c] rounded-2xl p-2.5 min-h-[50px] border border-gray-700 shadow-inner flex items-end">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                  placeholder={activeMode === AppMode.FACESWAP ? "Swap details..." : "Message..."}
                  className="w-full bg-transparent border-none outline-none resize-none text-[15px] px-2 pt-1 max-h-32 min-h-[24px]"
                  rows={1}
                />
              </div>
              
              <button 
                onClick={handleSend}
                disabled={isLoading}
                className={`w-12 h-12 rounded-full flex items-center justify-center transition-all shadow-lg shrink-0 ${isLoading ? 'bg-gray-700' : 'bg-[#2481cc] hover:bg-[#288fde] active:scale-95'}`}
              >
                {isLoading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <ICONS.Send className="w-6 h-6 ml-0.5" />}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
