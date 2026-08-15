import { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';

const DEFAULT_ASSISTANT = {
    name: 'Asisten JDIH DIY',
    tagline: 'Menjawab hanya berdasarkan dokumen peraturan ini',
    greeting: 'Halo! 👋 Saya Asisten JDIH DIY.\nSilakan tanyakan apa saja seputar dokumen ini.',
    suggested: [],
};

export default function ChatPanel({ documentId, onCitation, assistant, onClose }) {
    const a = { ...DEFAULT_ASSISTANT, ...(assistant || {}) };

    const [messages, setMessages] = useState([{ role: 'ai', text: a.greeting }]);
    const [suggestions, setSuggestions] = useState(a.suggested || []);
    const [loadingSuggestions, setLoadingSuggestions] = useState(false);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const endRef = useRef(null);
    const fetchedWelcome = useRef(false);

    // Ambil pertanyaan awal dari backend (sesuai isi dokumen)
    useEffect(() => {
        if (fetchedWelcome.current) return;
        fetchedWelcome.current = true;
        setLoadingSuggestions(true);
        axios.get(`/documents/${documentId}/suggestions`)
            .then(({ data }) => {
                if (Array.isArray(data.suggestions) && data.suggestions.length > 0) {
                    setSuggestions(data.suggestions);
                }
            })
            .catch(() => {})
            .finally(() => setLoadingSuggestions(false));
    }, [documentId]);

    useEffect(() => {
        endRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, loading]);

    const send = async (question) => {
        const q = (question ?? input).trim();
        if (!q || loading) return;
        setInput('');
        setSuggestions([]); // hilangkan chips saat mulai chat
        setMessages((m) => [...m, { role: 'user', text: q }]);
        setLoading(true);

        try {
            const { data } = await axios.post(`/documents/${documentId}/chat`, { question: q });
            setMessages((m) => [...m, {
                role: 'ai',
                text: data.answer,
                refs: data.references ?? [],
            }]);
            // Tampilkan pertanyaan lanjutan dari backend
            if (Array.isArray(data.suggestions) && data.suggestions.length > 0) {
                setSuggestions(data.suggestions);
            }
            if (data.references?.length) onCitation(data.references[0]);
        } catch (e) {
            const msg = e.response?.data?.answer ?? e.response?.data?.message ?? e.message;
            setMessages((m) => [...m, { role: 'ai', text: msg, isError: true }]);
        } finally {
            setLoading(false);
        }
    };

    const showWelcome = messages.length === 1 && !loading;

    return (
        <div className="flex h-full flex-col bg-gradient-to-b from-slate-50 to-white">
            {/* ===== Header asisten ===== */}
            <div className="flex items-center gap-3 border-b border-slate-200/70 bg-white/80 backdrop-blur px-4 py-3">
                <div className="relative">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 text-white shadow-lg shadow-indigo-200">
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/>
                            <path strokeLinecap="round" strokeLinejoin="round" d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10M12 3v18M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2"/>
                        </svg>
                    </div>
                    <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-white bg-green-500"></span>
                </div>
                <div className="min-w-0 flex-1">
                    <h3 className="truncate text-sm font-bold text-slate-800">{a.name}</h3>
                    <p className="truncate text-xs text-slate-500">{a.tagline}</p>
                </div>
                {onClose && (
                    <button onClick={onClose} title="Tutup chat"
                            className="rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700">
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
                        </svg>
                    </button>
                )}
            </div>

            {/* ===== Area pesan ===== */}
            <div className="flex-1 space-y-4 overflow-y-auto p-4">
                {messages.map((m, i) => (
                    <div
                        key={i}
                        className={`flex animate-[fadeIn_0.4s_ease-out] ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                        {m.role === 'ai' && (
                            <div className="mr-2 mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 text-xs text-white shadow">
                                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10M12 3v18M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2"/>
                                </svg>
                            </div>
                        )}
                        <div
                            className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm shadow-sm transition-all ${
                                m.role === 'user'
                                    ? 'rounded-br-sm bg-gradient-to-br from-indigo-600 to-purple-600 text-white'
                                    : m.isError
                                      ? 'rounded-bl-sm border border-red-200 bg-red-50 text-red-700'
                                      : 'rounded-bl-sm border border-slate-200 bg-white text-slate-700'
                            }`}
                        >
                            {m.role === 'ai' ? (
                                <div className="prose prose-sm prose-slate max-w-none prose-p:leading-relaxed prose-headings:font-semibold">
                                    <ReactMarkdown
                                        components={{
                                            p: ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>,
                                            strong: ({ children }) => <span className="font-semibold text-slate-900">{children}</span>,
                                            em: ({ children }) => <em className="italic text-slate-600">{children}</em>,
                                        }}
                                    >
                                        {m.text}
                                    </ReactMarkdown>
                                </div>
                            ) : (
                                <p className="whitespace-pre-wrap leading-relaxed">{m.text}</p>
                            )}

                            {m.refs?.length > 0 && (
                                <div className="mt-3 space-y-1.5 border-t border-slate-200 pt-2">
                                    <p className="text-xs font-semibold text-slate-500">📖 Referensi:</p>
                                    {m.refs.map((r, j) => (
                                        <button
                                            key={j}
                                            onClick={() => onCitation(r)}
                                            className="flex w-full items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-left text-xs font-medium text-indigo-700 transition hover:bg-indigo-100"
                                        >
                                            📄 Halaman {r.page} — lihat sumber
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                ))}

                {/* Typing indicator */}
                {loading && (
                    <div className="flex animate-[fadeIn_0.3s_ease-out] justify-start">
                        <div className="mr-2 mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 text-white shadow">
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/>
                                <path strokeLinecap="round" strokeLinejoin="round" d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10M12 3v18M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2"/>
                            </svg>
                        </div>
                        <div className="rounded-2xl rounded-bl-sm border border-slate-200 bg-white px-4 py-3 shadow-sm">
                            <div className="flex gap-1.5">
                                <span className="h-2 w-2 animate-bounce rounded-full bg-indigo-400"></span>
                                <span className="h-2 w-2 animate-bounce rounded-full bg-purple-400" style={{ animationDelay: '0.15s' }}></span>
                                <span className="h-2 w-2 animate-bounce rounded-full bg-pink-400" style={{ animationDelay: '0.3s' }}></span>
                            </div>
                        </div>
                    </div>
                )}
                <div ref={endRef}/>
            </div>

            {/* ===== Chips pertanyaan (welcome atau follow-up) ===== */}
            {(showWelcome || (messages.length > 1 && suggestions.length > 0)) && !loading && (
                <div className="border-t border-slate-200 bg-white px-4 pt-3 pb-2 animate-[fadeIn_0.4s_ease-out]">
                    <p className="mb-2 text-xs font-semibold text-slate-500">
                        {showWelcome ? (loadingSuggestions ? '⏳ Menyusun pertanyaan...' : '💡 Coba tanyakan:') : '🔗 Lanjutkan diskusi:'}
                    </p>
                    <div className="flex flex-wrap gap-2">
                        {suggestions.map((s, i) => (
                            <button
                                key={i}
                                onClick={() => send(s)}
                                className="rounded-full border border-indigo-200 bg-gradient-to-r from-indigo-50 to-purple-50 px-3 py-1.5 text-xs font-medium text-indigo-700 transition hover:from-indigo-100 hover:to-purple-100 hover:shadow-sm"
                            >
                                {s}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* ===== Input ===== */}
            <div className="flex items-center gap-2 border-t border-slate-200 bg-white p-3">
                <input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && send()}
                    placeholder="Tulis pertanyaan tentang dokumen ini…"
                    className="flex-1 rounded-full border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                />
                <button
                    onClick={() => send()}
                    disabled={loading || !input.trim()}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 text-white shadow-lg shadow-indigo-200 transition hover:scale-105 disabled:opacity-40 disabled:hover:scale-100"
                    title="Kirim"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
                        <path d="M3.478 2.404a.75.75 0 0 0-.926.941l2.432 7.905H13.5a.75.75 0 0 1 0 1.5H4.984l-2.432 7.905a.75.75 0 0 0 .926.94 60.519 60.519 0 0 0 18.445-8.986.75.75 0 0 0 0-1.218A60.517 60.517 0 0 0 3.478 2.404Z"/>
                    </svg>
                </button>
            </div>
        </div>
    );
}