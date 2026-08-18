import { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';

const DEFAULT_ASSISTANT = {
    name: 'Asisten JDIH DIY',
    tagline: 'Konsultan digital peraturan daerah Daerah Istimewa Yogyakarta',
    greeting: 'Selamat datang! 👋\nSaya siap membantu Anda memahami dokumen peraturan ini. Silakan ajukan pertanyaan, atau coba salah satu contoh di bawah.',
    suggested: [],
};

function ScalesIcon({ className }) {
    return (
        <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10M12 3v18M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2" />
        </svg>
    );
}

const nowTime = () =>
    new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

/**
 * Render teks jawaban dengan sitasi [1], [2], [3] inline sebagai badge clickable.
 * Contoh: "Berdasarkan Pasal 5 [1] disebutkan bahwa..." 
 *         → "Berdasarkan Pasal 5 <badge>1</badge> disebutkan bahwa..."
 */
function TextWithCitations({ text, refs, onCitation }) {
    if (!text) return null;

    // Regex untuk match [1], [2], [12], dll (1 atau 2 digit)
    const citationRegex = /\[(\d{1,2})\]/g;
    const parts = text.split(citationRegex);

    return (
        <>
            {parts.map((part, idx) => {
                // Bagian ganjil = angka sitasi, bagian genap = teks biasa
                if (idx % 2 === 1) {
                    const num = parseInt(part, 10);
                    const ref = refs?.find((r) => r.id === num);

                    if (ref) {
                        return (
                            <button
                                key={idx}
                                onClick={() => onCitation(ref)}
                                title={`Lihat sumber halaman ${ref.page}`}
                                className="mx-0.5 inline-flex h-4 w-4 items-center justify-center rounded-full bg-amber-400 text-[9px] font-bold text-blue-950 shadow-sm transition hover:bg-amber-300 hover:scale-110 active:scale-95 align-super"
                            >
                                {num}
                            </button>
                        );
                    }
                    // Fallback: kalau ref tidak ditemukan, render sebagai teks biasa
                    return <span key={idx} className="text-slate-400">[{part}]</span>;
                }
                return <span key={idx}>{part}</span>;
            })}
        </>
    );
}

export default function ChatPanel({ documentId, onCitation, assistant, onClose }) {
    const a = { ...DEFAULT_ASSISTANT, ...(assistant || {}) };

    const [messages, setMessages] = useState([{ role: 'ai', text: a.greeting, time: nowTime() }]);
    const [suggestions, setSuggestions] = useState(a.suggested || []);
    const [loadingSuggestions, setLoadingSuggestions] = useState(false);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const endRef = useRef(null);
    const fetchedWelcome = useRef(false);

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
        setSuggestions([]);
        setMessages((m) => [...m, { role: 'user', text: q, time: nowTime() }]);
        setLoading(true);

        try {
            const { data } = await axios.post(`/documents/${documentId}/chat`, { question: q });
            setMessages((m) => [...m, { role: 'ai', text: data.answer, refs: data.references ?? [], time: nowTime() }]);
            if (Array.isArray(data.suggestions) && data.suggestions.length > 0) {
                setSuggestions(data.suggestions);
            }
            // Otomatis jump ke halaman sumber pertama
            if (data.references?.length) onCitation(data.references[0]);
        } catch (e) {
            const msg = e.response?.data?.answer ?? e.response?.data?.message ?? e.message;
            setMessages((m) => [...m, { role: 'ai', text: msg, isError: true, time: nowTime() }]);
        } finally {
            setLoading(false);
        }
    };

    const showWelcome = messages.length === 1 && !loading;

    return (
        <div className="flex h-full flex-col bg-slate-50">
            {/* ===== Header ===== */}
            <div className="flex items-center gap-2 sm:gap-3 border-b border-slate-200 bg-white px-3 py-2.5 sm:px-4 sm:py-3">
                <div className="relative">
                    <div className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-lg sm:rounded-xl bg-blue-950 shadow">
                        <ScalesIcon className="h-4 w-4 sm:h-5 sm:w-5 text-amber-400" />
                    </div>
                    <span className="absolute -bottom-0.5 -right-0.5 h-2 w-2 sm:h-2.5 sm:w-2.5 rounded-full border-2 border-white bg-emerald-500"></span>
                </div>
                <div className="min-w-0 flex-1">
                    <h3 className="truncate text-sm font-bold text-slate-900">{a.name}</h3>
                    <p className="truncate text-[11px] sm:text-xs text-slate-500">{a.tagline}</p>
                </div>
                {onClose && (
                    <button onClick={onClose} title="Tutup chat"
                            className="rounded-full p-1.5 sm:p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 active:scale-95">
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                )}
            </div>

            {/* ===== Area pesan ===== */}
            <div className="flex-1 space-y-3 sm:space-y-4 overflow-y-auto p-3 sm:p-4">
                {messages.map((m, i) => (
                    <div key={i} className={`flex animate-[fadeIn_0.4s_ease-out] ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        {m.role === 'ai' && (
                            <div className="mr-2 mt-1 flex h-7 w-7 sm:h-8 sm:w-8 shrink-0 items-center justify-center rounded-lg bg-blue-950 shadow">
                                <ScalesIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-amber-400" />
                            </div>
                        )}
                        <div className={`flex max-w-[85%] sm:max-w-[80%] flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
                            <div className={`rounded-2xl px-3 py-2.5 sm:px-4 sm:py-3 text-xs sm:text-sm shadow-sm ${
                                    m.role === 'user'
                                        ? 'rounded-br-sm bg-blue-950 text-white'
                                        : m.isError
                                          ? 'rounded-bl-sm border border-red-200 bg-red-50 text-red-700'
                                          : 'rounded-bl-sm border border-slate-200 bg-white text-slate-700'
                                }`}>
                                {m.role === 'ai' ? (
                                    <div className="max-w-none">
                                        <ReactMarkdown
                                            components={{
                                                p: ({ children }) => (
                                                    <p className="mb-2 leading-relaxed last:mb-0">{children}</p>
                                                ),
                                                strong: ({ children }) => <span className="font-bold text-blue-950">{children}</span>,
                                                em: ({ children }) => <em className="italic text-slate-600">{children}</em>,
                                                code: ({ children }) => (
                                                    <code className="rounded bg-slate-100 px-1 py-0.5 text-[11px] text-slate-700">{children}</code>
                                                ),
                                                ul: ({ children }) => <ul className="mb-2 ml-4 list-disc space-y-1 last:mb-0">{children}</ul>,
                                                ol: ({ children }) => <ol className="mb-2 ml-4 list-decimal space-y-1 last:mb-0">{children}</ol>,
                                            }}
                                        >
                                            {m.text}
                                        </ReactMarkdown>
                                        
                                        {/* UPGRADE: Inline citation badges [1], [2], [3] */}
                                        {m.refs?.length > 0 && (
                                            <div className="mt-1 text-[11px] sm:text-xs text-slate-600">
                                                <TextWithCitations
                                                    text={extractCitations(m.text)}
                                                    refs={m.refs}
                                                    onCitation={onCitation}
                                                />
                                            </div>
                                        )}

                                        {/* UPGRADE: Section Referensi dengan snippet preview */}
                                        {m.refs?.length > 0 && (
                                            <div className="mt-3 space-y-1.5 border-t border-slate-200 pt-3">
                                                <p className="text-[10px] sm:text-xs font-semibold text-slate-500 flex items-center gap-1">
                                                    <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                    </svg>
                                                    Sumber dokumen ({m.refs.length}):
                                                </p>
                                                {m.refs.map((r) => (
                                                    <button
                                                        key={r.id}
                                                        onClick={() => onCitation(r)}
                                                        className="group flex w-full items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 p-2 text-left transition hover:border-amber-300 hover:bg-amber-50 active:scale-[0.99]"
                                                    >
                                                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-400 text-[10px] font-bold text-blue-950">
                                                            {r.id}
                                                        </span>
                                                        <div className="min-w-0 flex-1">
                                                            <div className="flex items-center gap-1.5">
                                                                <span className="text-[11px] font-semibold text-blue-900">Halaman {r.page}</span>
                                                                <svg className="h-3 w-3 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-amber-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                                                                </svg>
                                                            </div>
                                                            <p className="mt-0.5 line-clamp-2 text-[10px] leading-snug text-slate-600">
                                                                {r.snippet}
                                                            </p>
                                                        </div>
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <p className="whitespace-pre-wrap leading-relaxed">{m.text}</p>
                                )}
                            </div>
                            <span className="mt-1 px-1 text-[9px] sm:text-[10px] text-slate-400">{m.time}</span>
                        </div>
                    </div>
                ))}

                {/* Typing indicator halus */}
                {loading && (
                    <div className="flex animate-[fadeIn_0.3s_ease-out] justify-start">
                        <div className="mr-2 mt-1 flex h-7 w-7 sm:h-8 sm:w-8 shrink-0 items-center justify-center rounded-lg bg-blue-950 shadow">
                            <ScalesIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-amber-400" />
                        </div>
                        <div className="rounded-2xl rounded-bl-sm border border-slate-200 bg-white px-3 py-2.5 sm:px-4 sm:py-3 shadow-sm">
                            <div className="flex items-center gap-2 sm:gap-2.5">
                                <div className="flex gap-1">
                                    {[0, 1, 2].map((i) => (
                                        <span
                                            key={i}
                                            className="h-1.5 w-1.5 rounded-full bg-blue-900"
                                            style={{ animation: 'typingDot 1.2s ease-in-out infinite', animationDelay: `${i * 0.15}s` }}
                                        />
                                    ))}
                                </div>
                                <span className="text-[10px] sm:text-[10px] text-slate-400">Asisten sedang menulis…</span>
                            </div>
                        </div>
                    </div>
                )}
                <div ref={endRef} />
            </div>

            {/* ===== Chips pertanyaan ===== */}
            {(showWelcome || (messages.length > 1 && suggestions.length > 0)) && !loading && (
                <div className="animate-[fadeIn_0.4s_ease-out] border-t border-slate-200 bg-white px-3 pb-2 pt-2.5 sm:px-4 sm:pb-2 sm:pt-3">
                    <p className="mb-1.5 sm:mb-2 text-[11px] sm:text-xs font-semibold text-slate-500">
                        {showWelcome
                            ? (loadingSuggestions ? '⏳ Menyusun pertanyaan…' : '💡 Coba tanyakan:')
                            : '✨ Lanjutkan diskusi:'}
                    </p>
                    <div className="flex flex-wrap gap-1.5 sm:gap-2 max-h-32 sm:max-h-none overflow-y-auto">
                        {suggestions.map((s, i) => (
                            <button key={i} onClick={() => send(s)}
                                    className="rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 sm:px-3 sm:py-1.5 text-[11px] sm:text-xs font-medium text-blue-900 transition hover:border-amber-300 hover:bg-amber-50 hover:text-blue-950 active:scale-95">
                                {s}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* ===== Input ===== */}
            <div className="flex items-center gap-2 border-t border-slate-200 bg-white p-2 sm:p-3 pb-safe">
                <input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && send()}
                    placeholder="Tulis pertanyaan…"
                    className="flex-1 rounded-full border border-slate-300 bg-slate-50 px-3 py-2 sm:px-4 sm:py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:border-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-100"
                />
                <button onClick={() => send()} disabled={loading || !input.trim()}
                        className="flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-full bg-blue-950 text-white shadow transition hover:bg-blue-900 active:scale-95 disabled:opacity-40"
                        title="Kirim">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4 sm:h-5 sm:w-5">
                        <path d="M3.478 2.404a.75.75 0 0 0-.926.941l2.432 7.905H13.5a.75.75 0 0 1 0 1.5H4.984l-2.432 7.905a.75.75 0 0 0 .926.94 60.519 60.519 0 0 0 18.445-8.986.75.75 0 0 0 0-1.218A60.517 60.517 0 0 0 3.478 2.404Z" />
                    </svg>
                </button>
            </div>
        </div>
    );
}

/**
 * Helper: ekstrak bagian teks yang mengandung sitasi [n] dari jawaban.
 * Kalau AI tidak pakai sitasi inline, tampilkan list referensi saja tanpa badge inline.
 */
function extractCitations(text) {
    if (!text) return '';
    // Cek apakah ada pola [n] di teks
    if (/\[\d{1,2}\]/.test(text)) {
        return text;
    }
    // Kalau tidak ada, kembalikan string kosong (section referensi tetap tampil)
    return '';
}