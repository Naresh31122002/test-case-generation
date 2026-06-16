"use client"

import { useState, useRef, useEffect } from "react"
import { X, Brain, Sparkles, Send } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

interface ChatMessage {
  role: "user" | "assistant"
  content: string
}

interface ChatbotProps {
  onSendMessage: (message: string) => Promise<void>
  chatMessages: ChatMessage[]
  isGenerating: boolean
  selectedModel?: 'gemini' | 'rag'
  onModelChange?: (model: 'gemini' | 'rag') => void
}

export function Chatbot({ onSendMessage, chatMessages, isGenerating, selectedModel = 'rag', onModelChange }: ChatbotProps) {
  const [showChatbot, setShowChatbot] = useState(false)
  const [chatMessage, setChatMessage] = useState("")
  const [chatbotWidth, setChatbotWidth] = useState(400)
  const [chatbotHeight, setChatbotHeight] = useState(520)
  const [resizeDir, setResizeDir] = useState<string | null>(null)
  const isResizing = useRef(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const minWidth = 320
  const minHeight = 360
  const maxWidth = 700
  const maxHeight = 800

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [chatMessages, isGenerating])

  function handleResizeMouseDown(dir: string) {
    isResizing.current = true
    setResizeDir(dir)
    document.body.style.userSelect = 'none'
  }

  const handleSendMessage = async () => {
    if (!chatMessage.trim() || isGenerating) return
    const message = chatMessage.trim()
    setChatMessage("")
    await onSendMessage(message)
  }

  useEffect(() => {
    function handleMouseMove(e: MouseEvent) {
      if (!isResizing.current || !resizeDir) return;
      if (resizeDir.includes('e')) setChatbotWidth(w => Math.max(minWidth, Math.min(maxWidth, w + e.movementX)));
      if (resizeDir.includes('s')) setChatbotHeight(h => Math.max(minHeight, Math.min(maxHeight, h + e.movementY)));
      if (resizeDir.includes('w')) setChatbotWidth(w => Math.max(minWidth, Math.min(maxWidth, w - e.movementX)));
      if (resizeDir.includes('n')) setChatbotHeight(h => Math.max(minHeight, Math.min(maxHeight, h - e.movementY)));
    }
    function handleMouseUp() {
      isResizing.current = false;
      setResizeDir(null);
      document.body.style.userSelect = '';
    }
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [resizeDir]);

  return (
    <>
      {/* FAB — pill shaped with label */}
      {!showChatbot && (
        <button
          onClick={() => setShowChatbot(true)}
          className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-5 h-12 rounded-2xl shadow-2xl transition-all duration-200 hover:shadow-3xl hover:scale-105 active:scale-95"
          style={{ background: '#FF4D6D' }}
          onMouseEnter={e => (e.currentTarget.style.background = '#E11D48')}
          onMouseLeave={e => (e.currentTarget.style.background = '#FF4D6D')}
        >
          <Brain className="h-5 w-5 text-white flex-shrink-0" />
          <span className="text-white font-semibold text-sm whitespace-nowrap">AI Assistant</span>
        </button>
      )}

      {/* Chat panel */}
      {showChatbot && (
        <div
          className="fixed bottom-6 right-6 z-50 flex flex-col overflow-hidden rounded-2xl"
          style={{
            width: chatbotWidth,
            height: chatbotHeight,
            minWidth,
            minHeight,
            maxWidth,
            maxHeight,
            boxShadow: '0 24px 64px rgba(15,22,43,0.28)',
            background: '#ffffff',
          }}
        >
          {/* Header */}
          <div
            className="flex flex-col px-5 pt-4 pb-3 flex-shrink-0"
            style={{ background: '#1A1A2E' }}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <div
                  className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: 'rgba(162,210,233,0.18)' }}
                >
                  <Brain className="h-4 w-4" style={{ color: '#FFB3C1' }} />
                </div>
                <div>
                  <div className="text-white font-semibold text-sm leading-tight">CoverLoop Assistant</div>
                  <div className="text-xs leading-tight" style={{ color: '#FFB3C1' }}>
                    {isGenerating ? 'Generating…' : 'Ready'}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setShowChatbot(false)}
                className="w-8 h-8 rounded-xl flex items-center justify-center transition-colors"
                style={{ color: '#FFB3C1' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.1)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Mode toggle */}
            <div
              className="flex rounded-xl p-0.5"
              style={{ background: 'rgba(255,255,255,0.08)' }}
            >
              {(['rag', 'gemini'] as const).map(mode => (
                <button
                  key={mode}
                  onClick={() => onModelChange?.(mode)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-[10px] text-sm font-medium transition-all duration-150"
                  style={
                    selectedModel === mode
                      ? { background: '#FF4D6D', color: '#ffffff' }
                      : { color: '#FFB3C1' }
                  }
                >
                  {mode === 'rag' ? <Sparkles className="h-3.5 w-3.5" /> : <Brain className="h-3.5 w-3.5" />}
                  {mode === 'rag' ? 'RAG Mode' : 'Gemini Mode'}
                </button>
              ))}
            </div>
          </div>

          {/* Messages */}
          <div
            className="flex-1 overflow-y-auto px-4 py-4 space-y-3"
            style={{ background: '#FAFAFA', scrollbarWidth: 'thin' }}
          >
            {chatMessages.map((message, index) => (
              <div key={index} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className="px-4 py-2.5 rounded-2xl max-w-[82%] text-sm shadow-sm"
                  style={
                    message.role === "user"
                      ? { background: '#FF4D6D', color: '#ffffff', borderBottomRightRadius: 4 }
                      : { background: '#ffffff', color: '#1A1A2E', border: '1px solid #FECDD3', borderBottomLeftRadius: 4 }
                  }
                >
                  {message.role === "assistant" ? (
                    <pre className="whitespace-pre-wrap text-sm" style={{ background: 'none', margin: 0, padding: 0, border: 'none', fontFamily: 'inherit' }}>
                      {message.content?.trim() || '[No output from LLM]'}
                    </pre>
                  ) : (
                    <span className="whitespace-pre-wrap">{message.content}</span>
                  )}
                </div>
              </div>
            ))}

            {isGenerating && (
              <div className="flex justify-start">
                <div
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm shadow-sm"
                  style={{ background: '#ffffff', border: '1px solid #FECDD3', borderBottomLeftRadius: 4 }}
                >
                  <div className="flex gap-1">
                    {[0, 1, 2].map(i => (
                      <div
                        key={i}
                        className="w-1.5 h-1.5 rounded-full animate-bounce"
                        style={{ background: '#FF4D6D', animationDelay: `${-0.3 + i * 0.15}s` }}
                      />
                    ))}
                  </div>
                  <span style={{ color: '#6B7280' }}>Generating…</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div
            className="px-4 py-3 flex-shrink-0"
            style={{ background: '#ffffff', borderTop: '1px solid #FECDD3' }}
          >
            <div className="flex gap-2 items-center">
              <Input
                placeholder={selectedModel === 'rag' ? "Ask about this story…" : "Ask anything about testing…"}
                value={chatMessage}
                onChange={e => setChatMessage(e.target.value)}
                onKeyDown={e => e.key === "Enter" && !isGenerating && handleSendMessage()}
                disabled={isGenerating}
                className="flex-1 h-9 rounded-xl text-sm"
                style={{ border: '1.5px solid #FCA5A5', outline: 'none' }}
              />
              <button
                onClick={handleSendMessage}
                disabled={isGenerating || !chatMessage.trim()}
                className="h-9 w-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed hover:scale-105 active:scale-95"
                style={{ background: '#FF4D6D' }}
              >
                <Send className="h-4 w-4 text-white" />
              </button>
            </div>
          </div>

          {/* Resize handles */}
          <div onMouseDown={() => handleResizeMouseDown('nw')} className="absolute top-0 left-0 w-3 h-3 cursor-nwse-resize z-10" />
          <div onMouseDown={() => handleResizeMouseDown('ne')} className="absolute top-0 right-0 w-3 h-3 cursor-nesw-resize z-10" />
          <div onMouseDown={() => handleResizeMouseDown('sw')} className="absolute bottom-0 left-0 w-3 h-3 cursor-nesw-resize z-10" />
          <div onMouseDown={() => handleResizeMouseDown('se')} className="absolute bottom-0 right-0 w-3 h-3 cursor-nwse-resize z-10" />
          <div onMouseDown={() => handleResizeMouseDown('n')} className="absolute top-0 left-3 right-3 h-2 cursor-ns-resize z-10" />
          <div onMouseDown={() => handleResizeMouseDown('s')} className="absolute bottom-0 left-3 right-3 h-2 cursor-ns-resize z-10" />
          <div onMouseDown={() => handleResizeMouseDown('e')} className="absolute top-3 bottom-3 right-0 w-2 cursor-ew-resize z-10" />
          <div onMouseDown={() => handleResizeMouseDown('w')} className="absolute top-3 bottom-3 left-0 w-2 cursor-ew-resize z-10" />
        </div>
      )}
    </>
  )
}
