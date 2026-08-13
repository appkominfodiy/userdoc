import { useEffect, useRef, useState } from 'react';
import axios from 'axios';

export default function ChatPanel({ documentId, onCitation }) {
    const [messages, setMessages] = useState([
        { role: 'ai', text: 'Halo! Silakan tanya apa saja tentang dokumen ini.' },
    ]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const endRef = useRef(null);

    useEffect(() => {
        endRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, loading]);

    const send = async () => {
        const q = input.trim();
        if (!q || loading) return;
        setInput('');
        setMessages((m) => [...m, { role: 'user', text: q }]);
        setLoading(true);

        try {
            const { data } = await axios.post(`/documents/${documentId}/chat`, { question: q });
            setMessages((m) => [...m, { role: 'ai', text: data.answer, refs: data.references ?? [] }]);
            if (data.references?.length) onCitation(data.references[0]);
        } catch (e) {
            const msg = e.response?.data?.answer ?? e.response?.data?.message ?? e.message;
            setMessages((m) => [...m, { role: 'ai', text: '❌ ' + msg }]);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex h-full flex-col">
            <div className="border-b bg-gray-50 px-4 py-3">
                <h3 className="font-semibold">🤖 Asisten Hukum AI</h3>
                <p className="text-xs text-gray-500">Menjawab hanya dari dokumen ini</p>
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto p-4">
                {messages.map((m, i) => (
                    <div key={i} className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
                        <div className={`max-w-md rounded-lg p-3 text-sm ${m.role === 'user' ? 'bg-blue-600 text-white' : 'bg-gray-100'}`}>
                            <p className="whitespace-pre-wrap">{m.text}</p>

                            {m.refs?.length > 0 && (
                                <div className="mt-2 border-t border-gray-300 pt-2">
                                    <p className="mb-1 text-xs font-semibold text-gray-600">📖 Referensi:</p>
                                    {m.refs.map((r, j) => (
                                        <button key={j} onClick={() => onCitation(r)}
                                                className="mb-1 block w-full rounded border border-yellow-300 bg-yellow-50 p-2 text-left text-xs hover:bg-yellow-100">
                                            📄 Halaman {r.page} — lihat sumber
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                ))}
                {loading && <div className="text-sm text-gray-500">⏳ Mencari jawaban…</div>}
                <div ref={endRef} />
            </div>

            <div className="flex gap-2 border-t p-4">
                <input value={input}
                       onChange={(e) => setInput(e.target.value)}
                       onKeyDown={(e) => e.key === 'Enter' && send()}
                       placeholder="Contoh: Apa isi Pasal 5?"
                       className="flex-1 rounded-lg border px-4 py-2 focus:border-blue-500 focus:outline-none" />
                <button onClick={send}
                        className="rounded-lg bg-blue-600 px-6 py-2 text-white hover:bg-blue-700">
                    Kirim
                </button>
            </div>
        </div>
    );
}