import { useState } from 'react';
import { Link } from '@inertiajs/react';
import PdfViewer from '@/Components/PdfViewer';
import ChatPanel from '@/Components/ChatPanel';

const JENIS_LABEL = {
    PERGUB: 'Peraturan Gubernur',
    PERDA: 'Peraturan Daerah',
    KEPGUB: 'Keputusan Gubernur',
};

export default function Show({ document, assistant }) {
    const [page, setPage] = useState(1);
    const [highlight, setHighlight] = useState(null);
    const [infoOpen, setInfoOpen] = useState(false);
    const [chatOpen, setChatOpen] = useState(
        () => new URLSearchParams(window.location.search).get('chat') === '1'
    );

    const onCitation = (ref) => {
        if (!ref?.page) return;
        setHighlight(ref);
        setPage(ref.page);
        if (window.innerWidth < 768) setChatOpen(false);
    };

    const fmtLong = (t) =>
        t ? new Date(t).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' }) : '-';

    const shortTitle = `${JENIS_LABEL[document.jenis] ?? document.jenis} No. ${document.nomor}/${document.tahun}`;

    return (
        <div className="flex h-screen flex-col bg-[#f5f7fa]">
            {/* ===== SLIM HEADER: semua info dalam 1 baris ===== */}
            <header className="relative z-30 border-b border-slate-200/70 bg-white shadow-sm">
                <div className="flex items-center gap-2 px-3 py-2.5 sm:gap-3 sm:px-4">
                    <Link
                        href="/documents"
                        title="Kembali ke daftar dokumen"
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-blue-600"
                    >
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                        </svg>
                    </Link>

                    <img
                        src="https://jdih.jogjaprov.go.id/icon.png"
                        alt="JDIH DIY"
                        className="h-8 w-auto shrink-0 object-contain sm:h-9"
                    />

                    <div className="h-6 w-px shrink-0 bg-slate-200"></div>

                    {/* Identitas dokumen (truncate, lengkapnya di popover) */}
                    <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                            <h1 className="truncate text-sm font-bold text-slate-900 sm:text-base">{shortTitle}</h1>
                            <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                                document.status === 'berlaku' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
                            }`}>
                                {document.status}
                            </span>
                        </div>
                        <p className="truncate text-xs text-slate-500" title={document.judul}>{document.judul}</p>
                    </div>

                    {/* Tombol Info */}
                    <button
                        onClick={() => setInfoOpen((v) => !v)}
                        title="Detail dokumen"
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition ${
                            infoOpen ? 'bg-blue-100 text-blue-700' : 'text-slate-500 hover:bg-slate-100 hover:text-blue-600'
                        }`}
                    >
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    </button>

                    {/* Download */}
                    <a
                        href={`/documents/${document.id}/pdf`}
                        target="_blank"
                        className="flex shrink-0 items-center gap-2 rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 active:scale-[0.98] sm:px-5"
                    >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h14a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                        </svg>
                        <span className="hidden sm:inline">Download PDF</span>
                    </a>
                </div>

                {/* ===== POPOVER INFO: metadata lengkap ala web resmi ===== */}
                {infoOpen && (
                    <>
                        <div className="fixed inset-0 z-30" onClick={() => setInfoOpen(false)} />
                        <div className="absolute right-3 top-full z-40 mt-2 w-[min(92vw,400px)] rounded-2xl border border-slate-200 bg-white p-5 shadow-xl animate-[fadeIn_0.2s_ease-out]">
                            <div className="mb-4 flex items-center justify-between">
                                <h3 className="text-sm font-bold text-slate-900">Detail Dokumen</h3>
                                <button onClick={() => setInfoOpen(false)} className="rounded-lg p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700">
                                    <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>
                            <div className="space-y-3 text-sm">
                                <div className="flex gap-3">
                                    <span className="w-24 shrink-0 text-slate-500">Jenis</span>
                                    <span className="font-medium text-slate-800">{JENIS_LABEL[document.jenis] ?? document.jenis}</span>
                                </div>
                                <div className="flex gap-3">
                                    <span className="w-24 shrink-0 text-slate-500">Nomor</span>
                                    <span className="font-medium text-slate-800">{document.nomor}</span>
                                </div>
                                <div className="flex gap-3">
                                    <span className="w-24 shrink-0 text-slate-500">Tahun</span>
                                    <span className="font-medium text-slate-800">{document.tahun}</span>
                                </div>
                                <div className="flex gap-3">
                                    <span className="w-24 shrink-0 text-slate-500">Ditetapkan</span>
                                    <span className="font-medium text-slate-800">{fmtLong(document.tanggal_penetapan)}</span>
                                </div>
                                <div className="flex gap-3">
                                    <span className="w-24 shrink-0 text-slate-500">Status</span>
                                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                                        document.status === 'berlaku' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
                                    }`}>{document.status}</span>
                                </div>
                                <div className="border-t border-slate-100 pt-3">
                                    <span className="text-slate-500">Judul</span>
                                    <p className="mt-1 leading-relaxed text-slate-800">{document.judul}</p>
                                </div>
                            </div>
                        </div>
                    </>
                )}
            </header>

            {/* ===== KONTEN: PDF dominan + chat ===== */}
            <div className="flex flex-1 overflow-hidden">
                <div className="min-w-0 flex-1">
                    <PdfViewer url={`/documents/${document.id}/pdf`} page={page} highlight={highlight} onPageChange={setPage} />
                </div>

                {/* Desktop: side panel chat */}
                <div
                    className="hidden md:block overflow-hidden border-l border-slate-200 bg-white transition-all duration-300 ease-in-out"
                    style={{ width: chatOpen ? '420px' : '0' }}
                >
                    {chatOpen && (
                        <div className="h-full w-[420px]">
                            <ChatPanel documentId={document.id} onCitation={onCitation} onClose={() => setChatOpen(false)} assistant={assistant} />
                        </div>
                    )}
                </div>

                {/* Mobile: fullscreen drawer */}
                {chatOpen && (
                    <div className="md:hidden fixed inset-0 z-50 animate-[fadeIn_0.2s_ease-out] bg-white">
                        <ChatPanel documentId={document.id} onCitation={onCitation} onClose={() => setChatOpen(false)} assistant={assistant} />
                    </div>
                )}
            </div>

            {/* Floating button AI */}
            {!chatOpen && (
                <button
                    onClick={() => setChatOpen(true)}
                    title="Tanya Asisten AI"
                    className="fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-full bg-blue-600 py-3 pl-4 pr-5 text-sm font-semibold text-white shadow-xl shadow-blue-600/30 transition hover:bg-blue-700 active:scale-95 sm:bottom-6 sm:right-6"
                >
                    <svg className="h-5 w-5 text-amber-300" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3z" />
                    </svg>
                    <span>Tanya Asisten AI</span>
                </button>
            )}
        </div>
    );
}