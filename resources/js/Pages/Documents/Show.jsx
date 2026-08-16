import { useState } from 'react';
import { Link } from '@inertiajs/react';
import PdfViewer from '@/Components/PdfViewer';
import ChatPanel from '@/Components/ChatPanel';

export default function Show({ document, assistant }) {
    const [page, setPage] = useState(1);
    const [highlight, setHighlight] = useState(null);
    const [chatOpen, setChatOpen] = useState(
        () => new URLSearchParams(window.location.search).get('chat') === '1'
    );

    const onCitation = (ref) => {
        if (!ref?.page) return;
        setHighlight(ref);
        setPage(ref.page);
        // Di mobile, tutup chat otomatis biar user bisa lihat PDF
        if (window.innerWidth < 768) setChatOpen(false);
    };

    return (
        <div className="flex h-screen flex-col bg-slate-100">
            {/* ===== Header + Breadcrumb ===== */}
            <header className="border-b border-slate-200 bg-white px-3 py-2.5 sm:px-4 sm:py-3">
                <div className="mb-1.5 sm:mb-2 flex flex-wrap items-center gap-1 sm:gap-1.5 text-[10px] sm:text-[11px] text-slate-500">
                    <Link href="/documents" className="transition hover:text-blue-900 hover:underline">Beranda</Link>
                    <span className="text-slate-300">/</span>
                    <Link href="/documents" className="transition hover:text-blue-900 hover:underline">Produk Hukum</Link>
                    <span className="text-slate-300">/</span>
                    <span className="font-semibold text-slate-800">
                        {document.jenis} No. {document.nomor}/{document.tahun}
                    </span>
                </div>

                <div className="flex items-center justify-between gap-2 sm:gap-3">
                    <div className="flex min-w-0 items-center gap-2 sm:gap-3">
                        <Link
                            href="/documents"
                            className="flex shrink-0 items-center gap-1 rounded-full bg-blue-950 px-2.5 py-1.5 sm:px-4 sm:py-2 text-[11px] sm:text-xs font-semibold text-white transition hover:bg-blue-900"
                        >
                            <svg className="h-3 w-3 sm:h-3.5 sm:w-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                            </svg>
                            <span className="hidden sm:inline">Kembali</span>
                        </Link>
                        <div className="min-w-0">
                            <div className="flex items-center gap-1 sm:gap-2 text-[10px] sm:text-xs font-bold text-blue-950">
                                <span className="truncate">
                                    {document.jenis} No. {document.nomor}/{document.tahun}
                                </span>
                                <span className={`shrink-0 rounded-full px-1.5 sm:px-2.5 py-0.5 text-[8px] sm:text-[10px] font-medium ${document.status === 'berlaku' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                                    {document.status}
                                </span>
                            </div>
                            <h2 className="truncate text-[11px] sm:text-sm font-semibold text-slate-700">{document.judul}</h2>
                        </div>
                    </div>

                    <a
                        href={`/documents/${document.id}/pdf`}
                        target="_blank"
                        className="flex shrink-0 items-center gap-1 rounded-full border border-blue-950 px-2.5 py-1.5 sm:px-4 sm:py-2 text-[11px] sm:text-xs font-semibold text-blue-950 transition hover:bg-blue-950 hover:text-white"
                    >
                        <svg className="h-3.5 w-3.5 sm:hidden" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v12m0 0 4-4m-4 4-4-4M4 20h16" />
                        </svg>
                        <span className="hidden sm:inline">Download</span>
                    </a>
                </div>
            </header>

            {/* ===== Konten (PDF) ===== */}
            <div className="flex flex-1 overflow-hidden relative">
                <div className="min-w-0 flex-1">
                    <PdfViewer url={`/documents/${document.id}/pdf`} page={page} highlight={highlight} onPageChange={setPage} />
                </div>

                {/* Desktop / Tablet: side panel */}
                <div className="hidden md:block border-l border-slate-200 bg-white transition-all duration-300 overflow-hidden"
                     style={{ width: chatOpen ? '45%' : '0' }}>
                    {chatOpen && (
                        <ChatPanel documentId={document.id} onCitation={onCitation} onClose={() => setChatOpen(false)} assistant={assistant} />
                    )}
                </div>

                {/* Mobile: fullscreen drawer */}
                {chatOpen && (
                    <div className="md:hidden fixed inset-0 z-50 bg-white animate-[fadeIn_0.3s_ease-out]">
                        <ChatPanel documentId={document.id} onCitation={onCitation} onClose={() => setChatOpen(false)} assistant={assistant} />
                    </div>
                )}
            </div>

            {/* ===== Floating button ===== */}
            {!chatOpen && (
                <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-40 flex items-center gap-3">
                    <div className="hidden rounded-xl border border-slate-200 bg-white/90 px-4 py-2 text-xs font-semibold text-slate-700 shadow-lg backdrop-blur lg:block">
                        Tanya Asisten AI
                    </div>
                    <button
                        onClick={() => setChatOpen(true)}
                        title="Tanya Asisten AI"
                        className="group relative flex h-12 w-12 sm:h-16 sm:w-16 items-center justify-center rounded-full bg-blue-950 shadow-xl shadow-blue-950/40 ring-2 ring-amber-400/70 transition hover:scale-105 active:scale-95"
                    >
                        <span className="absolute inset-0 animate-ping rounded-full bg-amber-400/20"></span>
                        <svg className="relative h-5 w-5 sm:h-7 sm:w-7 text-amber-400 transition-transform group-hover:scale-110" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10M12 3v18M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2" />
                        </svg>
                    </button>
                </div>
            )}
        </div>
    );
}