import { useState, useRef, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import { api } from '../api'

function chatStorageKey(documentId) {
  return `chatbot_perda_messages_${documentId}`
}

function Chatbot({ documentId, onJumpToPage }) {
  // Lazy initializer -- dihitung sekali saat komponen pertama mount
  // (dan karena parent pakai key={documentId}, ini "pertama mount"
  // lagi setiap kali dokumen berganti). Sinkron, bukan lewat effect.
  const [messages, setMessages] = useState(() => {
    if (!documentId) return []
    const saved = localStorage.getItem(chatStorageKey(documentId))
    return saved ? JSON.parse(saved) : []
  })

  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef(null)

  useEffect(() => {
    if (!documentId) return
    localStorage.setItem(chatStorageKey(documentId), JSON.stringify(messages))
  }, [messages, documentId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function handleSend() {
    const question = input.trim()
    if (!question || loading) return

    setMessages((prev) => [...prev, { role: 'user', text: question }])
    setInput('')
    setLoading(true)

    try {
      const res = await api.post('/chat', { document_id: documentId, question })
      setMessages((prev) => [
        ...prev,
        {
          role: 'bot',
          text: res.data.answer,
          sourcePages: res.data.source_pages,
          sourcePasal: res.data.source_pasal,
        },
      ])
    } catch (err) {
      console.error(err)
      setMessages((prev) => [
        ...prev,
        { role: 'bot', text: 'Terjadi kesalahan saat menghubungi server. Coba lagi.', isError: true },
      ])
    } finally {
      setLoading(false)
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="flex flex-col h-full bg-white">
      <div className="px-4 py-3 border-b border-slate-100">
        <p className="text-sm font-medium text-slate-700">Tanya dokumen ini</p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center mt-10">
            <p className="text-slate-400 text-sm">
              Tanyakan sesuatu tentang dokumen ini
            </p>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : ''}`}>
            {msg.role === 'bot' && (
              <div className="w-7 h-7 flex-shrink-0 rounded-full bg-red-100 text-red-700 flex items-center justify-center text-xs font-semibold">
                AI
              </div>
            )}

            <div
              className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-sm ${
                msg.role === 'user'
                  ? 'bg-red-800 text-white rounded-br-sm'
                  : msg.isError
                  ? 'bg-red-50 text-red-600 border border-red-100 rounded-bl-sm'
                  : 'bg-slate-100 text-slate-700 rounded-bl-sm'
              }`}
            >
              {msg.role === 'bot' ? (
                <div className="prose prose-sm max-w-none prose-p:my-1 prose-ul:my-1">
                  <ReactMarkdown>{msg.text}</ReactMarkdown>
                </div>
              ) : (
                <p className="whitespace-pre-wrap">{msg.text}</p>
              )}

              {msg.role === 'bot' && msg.sourcePasal?.length > 0 && (
                <div className="mt-2 pt-2 border-t border-slate-200 flex flex-wrap gap-1.5">
                  {msg.sourcePasal.map((pasal, j) => (
                    <button
                      key={j}
                      onClick={() => onJumpToPage(msg.sourcePages[j])}
                      className="text-xs px-2 py-1 bg-white border border-slate-200 rounded-full text-slate-600 hover:border-red-300 hover:text-red-700 transition"
                    >
                      {pasal} · hal.{msg.sourcePages[j]}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex gap-2">
            <div className="w-7 h-7 flex-shrink-0 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-xs font-semibold">
              AI
            </div>
            <div className="bg-slate-100 px-4 py-2.5 rounded-2xl rounded-bl-sm flex gap-1 items-center">
              <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
              <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
              <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" />
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      <div className="p-3 border-t border-slate-100 flex gap-2">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Tanyakan sesuatu..."
          rows={1}
          className="flex-1 resize-none border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 focus:border-transparent"
        />
        <button
          onClick={handleSend}
          disabled={loading || !input.trim()}
          className="px-4 py-2 bg-red-800 text-white rounded-xl text-sm disabled:opacity-40 hover:bg-red-900 transition"
        >
          Kirim
        </button>
      </div>
    </div>
  )
}

export default Chatbot