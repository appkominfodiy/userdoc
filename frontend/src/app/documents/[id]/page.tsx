"use client";

import { useEffect, useRef, useState, use } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Document, Page, pdfjs } from "react-pdf";
import ReactMarkdown from "react-markdown";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

import {
  fetchDocumentDetail,
  prepareDocument,
  getPdfUrl,
  sendChatMessage,
  fetchSuggestedQuestions,
  fetchFollowupQuestions,
} from "@/lib/api";
import type { JdihDocument, ChatMessage } from "@/types/document";

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

export default function DocumentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: docId } = use(params);
  const searchParams = useSearchParams();
  const router = useRouter();
  const slug = searchParams.get("slug") || "";

  const [detail, setDetail] = useState<JdihDocument | null>(null);
  const [preparing, setPreparing] = useState(true);
  const [prepareError, setPrepareError] = useState<string | null>(null);
  const [numPages, setNumPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState(1);

  const [scale, setScale] = useState<number>(1.0);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [question, setQuestion] = useState("");
  const [sending, setSending] = useState(false);

  const [starterQuestions, setStarterQuestions] = useState<string[]>([]);
  const [loadingStarters, setLoadingStarters] = useState(false);
  const [followupQuestions, setFollowupQuestions] = useState<string[]>([]);
  const [loadingFollowup, setLoadingFollowup] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const didInit = useRef(false);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, preparing]);

  useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;
    if (!slug) return;

    fetchDocumentDetail(docId, slug)
      .then((data) => setDetail(data))
      .catch(() => setPrepareError("Gagal mengambil detail dokumen."));

    setPreparing(true);
    prepareDocument(docId, slug)
      .then(async () => {
        setPreparing(false);
        // Pertanyaan starter dibuat LLM dari isi dokumen ASLI — beda dokumen, beda saran.
        setLoadingStarters(true);
        try {
          const qs = await fetchSuggestedQuestions(docId);
          setStarterQuestions(qs);
        } finally {
          setLoadingStarters(false);
        }
      })
      .catch(() => {
        setPrepareError("Gagal menyiapkan dokumen. Coba refresh halaman ini.");
        setPreparing(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSend(textOverride?: string) {
    const text = (textOverride || question).trim();
    if (!text || sending) return;

    setMessages((prev) => [...prev, { role: "user", text }]);
    setQuestion("");
    setFollowupQuestions([]); // sembunyikan follow-up lama selama menunggu jawaban baru
    setSending(true);

    try {
      const res = await sendChatMessage(docId, text);
      setMessages((prev) => [...prev, { role: "assistant", text: res.answer, sources: res.sources }]);
      setSending(false);

      // Generate pertanyaan lanjutan berdasarkan jawaban yang baru saja diberikan
      setLoadingFollowup(true);
      try {
        const followups = await fetchFollowupQuestions(docId, text, res.answer);
        setFollowupQuestions(followups);
      } finally {
        setLoadingFollowup(false);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", text: "Maaf, terjadi kesalahan saat memproses pertanyaan." },
      ]);
      setSending(false);
    }
  }

  const handleZoomIn = () => setScale((prev) => Math.min(prev + 0.25, 2.5));
  const handleZoomOut = () => setScale((prev) => Math.max(prev - 0.25, 0.5));
  const handleZoomReset = () => setScale(1.0);

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        <button
          onClick={() => router.push("/")}
          className="mb-4 text-sm text-gray-600 hover:text-blue-600 flex items-center gap-1 transition-colors font-medium"
        >
          ← Kembali ke daftar dokumen
        </button>

        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-6 leading-snug">
          {detail?.judul_peraturan || "Memuat dokumen..."}
        </h1>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {/* PDF Viewer */}
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden flex flex-col">
            <div className="p-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
              <h2 className="font-semibold text-gray-900 flex items-center gap-2">Preview Dokumen</h2>
              <div className="flex items-center gap-2 bg-white rounded border border-gray-300 p-1">
                <button onClick={handleZoomOut} disabled={scale <= 0.5} className="px-3 py-1 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded disabled:opacity-40 transition-colors">−</button>
                <span className="px-3 text-sm font-medium text-gray-900 min-w-[60px] text-center">{Math.round(scale * 100)}%</span>
                <button onClick={handleZoomIn} disabled={scale >= 2.5} className="px-3 py-1 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded disabled:opacity-40 transition-colors">+</button>
                <button onClick={handleZoomReset} className="px-3 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50 rounded transition-colors border-l border-gray-300 ml-1">Reset</button>
              </div>
            </div>

            <div className="p-4 bg-gray-100 overflow-auto flex-grow" style={{ maxHeight: "calc(100vh - 250px)" }}>
              {preparing && (
                <div className="flex flex-col items-center justify-center py-32">
                  <div className="animate-spin h-10 w-10 border-4 border-blue-600 border-t-transparent rounded-full mb-3"></div>
                  <p className="text-gray-700 font-medium">Menyiapkan dokumen...</p>
                </div>
              )}
              {prepareError && (
                <div className="text-center py-20">
                  <p className="text-red-600 font-medium mb-3">{prepareError}</p>
                  <button onClick={() => window.location.reload()} className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 text-sm font-medium">Coba Lagi</button>
                </div>
              )}
              {!preparing && !prepareError && (
                <div className="flex flex-col items-center">
                  <Document file={getPdfUrl(docId)} onLoadSuccess={({ numPages }) => setNumPages(numPages)} loading={<p className="text-gray-500 py-10">Memuat PDF...</p>} error={<p className="text-red-600 py-10">Gagal memuat PDF.</p>} className="shadow-lg">
                    <Page pageNumber={currentPage} scale={scale} className="rounded bg-white" />
                  </Document>
                  <div className="flex items-center gap-4 mt-4 bg-white px-4 py-2 rounded border border-gray-200">
                    <button onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage <= 1} className="px-3 py-1 rounded border border-gray-300 bg-white disabled:opacity-40 hover:bg-gray-50 text-sm font-medium transition-colors">◀ Prev</button>
                    <span className="text-sm text-gray-700 font-medium min-w-[120px] text-center">Halaman {currentPage} / {numPages || "…"}</span>
                    <button onClick={() => setCurrentPage((p) => Math.min(numPages, p + 1))} disabled={currentPage >= numPages} className="px-3 py-1 rounded border border-gray-300 bg-white disabled:opacity-40 hover:bg-gray-50 text-sm font-medium transition-colors">Next ▶</button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Chatbot */}
          <div className="bg-white rounded-lg border border-gray-200 flex flex-col overflow-hidden shadow-sm" style={{ maxHeight: "calc(100vh - 200px)" }}>
            <div className="p-4 border-b border-gray-200 bg-gray-50">
              <h2 className="font-semibold text-gray-900 text-sm">💬 Tanya AI tentang Dokumen</h2>
              <p className="text-xs text-gray-600 mt-0.5">AI menjawab berdasarkan isi dokumen</p>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-white">
              {messages.length === 0 && !preparing && (
                <div className="text-center text-gray-500 mt-4">
                  <p className="text-xs font-medium mb-3">Pertanyaan yang disarankan:</p>
                </div>
              )}

              {messages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`chat-bubble-enter flex gap-2 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${msg.role === "user" ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-800"}`}>
                    {msg.role === "assistant" ? (
                      <div>
                        <div className="prose prose-sm max-w-none">
                          <ReactMarkdown>{msg.text}</ReactMarkdown>
                        </div>
                        {msg.sources && msg.sources.length > 0 && (
                          <div className="mt-2 pt-2 border-t border-gray-300">
                            <div className="flex flex-wrap gap-1">
                              {msg.sources.map((source, sIdx) => (
                                <span
                                  key={sIdx}
                                  style={{ animationDelay: `${sIdx * 80}ms` }}
                                  className="source-badge-enter inline-flex items-center px-2 py-0.5 rounded text-xs bg-green-100 text-green-800"
                                >
                                  📄 {source.page}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      msg.text
                    )}
                  </div>
                </div>
              ))}

              {/* Pertanyaan STARTER — cuma tampil sebelum chat dimulai */}
              {messages.length === 0 && !sending && (
                <div className="space-y-2">
                  {loadingStarters && (
                    <p className="text-xs text-gray-400 flex items-center gap-1.5">
                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-400 typing-dot" />
                      Menyiapkan pertanyaan yang relevan...
                    </p>
                  )}
                  {starterQuestions.map((q, idx) => (
                    <button
                      key={q}
                      onClick={() => handleSend(q)}
                      style={{ animationDelay: `${idx * 60}ms` }}
                      className="suggestion-chip-enter w-full text-left px-3 py-2 text-xs bg-blue-50 hover:bg-blue-100 text-blue-900 rounded border border-blue-200 transition-colors"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              )}

              {/* Pertanyaan FOLLOW-UP — muncul setelah setiap jawaban chatbot */}
              {messages.length > 0 && !sending && (loadingFollowup || followupQuestions.length > 0) && (
                <div className="space-y-2 pt-1">
                  <p className="text-xs text-gray-400">Lanjutkan dengan:</p>
                  {loadingFollowup && (
                    <p className="text-xs text-gray-400 flex items-center gap-1.5">
                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-400 typing-dot" />
                      Memikirkan pertanyaan lanjutan...
                    </p>
                  )}
                  {followupQuestions.map((q, idx) => (
                    <button
                      key={q}
                      onClick={() => handleSend(q)}
                      style={{ animationDelay: `${idx * 60}ms` }}
                      className="suggestion-chip-enter w-full text-left px-3 py-2 text-xs bg-blue-50 hover:bg-blue-100 text-blue-900 rounded border border-blue-200 transition-colors"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              )}

              {sending && (
                <div className="chat-bubble-enter flex gap-2 justify-start">
                  <div className="bg-gray-100 rounded-lg px-3 py-2 text-sm text-gray-500">
                    <span className="inline-flex gap-1">
                      <span className="typing-dot inline-block w-1.5 h-1.5 rounded-full bg-gray-400" style={{ animationDelay: "0s" }} />
                      <span className="typing-dot inline-block w-1.5 h-1.5 rounded-full bg-gray-400" style={{ animationDelay: "0.15s" }} />
                      <span className="typing-dot inline-block w-1.5 h-1.5 rounded-full bg-gray-400" style={{ animationDelay: "0.3s" }} />
                    </span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            <div className="p-3 border-t border-gray-200 bg-white">
              <div className="flex gap-2">
                <input
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
                  disabled={preparing || sending}
                  placeholder="Ketik pertanyaan..."
                  className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                />
                <button
                  onClick={() => handleSend()}
                  disabled={preparing || sending || !question.trim()}
                  className="bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded w-9 h-9 flex items-center justify-center transition-colors"
                >
                  ➤
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}