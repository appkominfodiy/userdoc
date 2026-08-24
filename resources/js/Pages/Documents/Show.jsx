import { useRef, useState, useEffect } from 'react';
import { Link } from '@inertiajs/react';
import PdfViewer from '@/Components/PdfViewer';
import ChatPanel from '@/Components/ChatPanel';

const JENIS_LABEL = {
    PERGUB: 'Peraturan Gubernur',
    PERDA: 'Peraturan Daerah',
    KEPGUB: 'Keputusan Gubernur',
};

const MIN_CHAT = 320;
const DEFAULT_CHAT = 420;
const MIN_CHAT_HEIGHT = 220;
const DEFAULT_CHAT_HEIGHT = 320;

export default function Show({ document, assistant }) {
    const [page, setPage] = useState(1);
    const [highlight, setHighlight] = useState(null);
    const [infoOpen, setInfoOpen] = useState(false);
    const [chatOpen, setChatOpen] = useState(
        () => new URLSearchParams(window.location.search).get('chat') !== '0'
    );
    const [chatWidth, setChatWidth] = useState(DEFAULT_CHAT);
    const [chatHeight, setChatHeight] = useState(DEFAULT_CHAT_HEIGHT);
    const [isResizing, setIsResizing] = useState(false);
    const [isMobile, setIsMobile] = useState(false);
    const dragging = useRef(false);

    // Deteksi mobile responsive
    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth < 768);
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    const onCitation = (ref) => {
        if (!ref?.page) return;
        setHighlight(ref);
        setPage(ref.page);
    };

    const fmtLong = (t) =>
        t ? new Date(t).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' }) : '-';

    const shortTitle = `${JENIS_LABEL[document.jenis] ?? document.jenis} No. ${document.nomor}/${document.tahun}`;

    // ===== RESIZER HORIZONTAL (desktop) dengan safety checks =====
    const onPointerDown = (e) => {
        e.preventDefault();
        dragging.current = true;
        setIsResizing(true);
        if (e.currentTarget?.setPointerCapture) {
            e.currentTarget.setPointerCapture(e.pointerId);
        }
        if (typeof document !== 'undefined' && document.body) {
            document.body.style.userSelect = 'none';
            document.body.style.cursor = 'col-resize';
        }
    };

    const onPointerMove = (e) => {
        if (!dragging.current) return;
        const max = Math.round(window.innerWidth * 0.75);
        const w = window.innerWidth - e.clientX;
        setChatWidth(Math.min(Math.max(w, MIN_CHAT), max));
    };

    // ===== RESIZER VERTIKAL (mobile) =====
    const onPointerDownMobile = (e) => {
        e.preventDefault();
        dragging.current = true;
        setIsResizing(true);
        if (e.currentTarget?.setPointerCapture) {
            e.currentTarget.setPointerCapture(e.pointerId);
        }
        if (typeof document !== 'undefined' && document.body) {
            document.body.style.userSelect = 'none';
            document.body.style.cursor = 'row-resize';
        }
    };

    const onPointerMoveMobile = (e) => {
        if (!dragging.current) return;
        const max = Math.round(window.innerHeight * 0.75);
        const h = window.innerHeight - e.clientY;
        setChatHeight(Math.min(Math.max(h, MIN_CHAT_HEIGHT), max));
    };

    const onPointerUp = () => {
        if (!dragging.current) return;
        dragging.current = false;
        setIsResizing(false);
        if (typeof document !== 'undefined' && document.body) {
            document.body.style.userSelect = '';
            document.body.style.cursor = '';
        }
    };

    return (
        <div className="flex h-screen flex-col bg-[#f5f7fa]">
            {/* ===== SLIM HEADER (responsive) ===== */}
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

                    <div className="h-6 w-px shrink-0 bg-slate-200 hidden sm:block"></div>

                    <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                            <h1 className="truncate text-sm font-bold text-slate-900 sm:text-base">{shortTitle}</h1>
                            <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                                document.status === 'berlaku' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
                            }`}>
                                {document.status}
                            </span>
                        </div>
                        <p className="truncate text-xs text-slate-500 hidden sm:block" title={document.judul}>{document.judul}</p>
                    </div>

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

                {/* ===== POPOVER INFO ===== */}
                {infoOpen && (
                    <>
                        <div className="fixed inset-0 z-30" onClick={() => setInfoOpen(false)} />
                        <div className="absolute right-3 top-full z-40 mt-2 w-[min(92vw,400px)] animate-[fadeIn_0.2s_ease-out] rounded-2xl border border-slate-200 bg-white p-5 shadow-xl">
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

            {/* ===== KONTEN: PDF + RESIZER + CHAT (responsive) ===== */}
            <div className={`flex flex-1 overflow-hidden ${isMobile ? 'flex-col' : 'flex-row'}`}>
                <div className="min-h-0 min-w-0 flex-1">
                    <PdfViewer url={`/documents/${document.id}/pdf`} page={page} highlight={highlight} onPageChange={setPage} />
                </div>

                {/* Desktop/Tablet: RESIZER horizontal + Chat side panel */}
                {!isMobile && chatOpen && (
                    <>
                        <div
                            onPointerDown={onPointerDown}
                            onPointerMove={onPointerMove}
                            onPointerUp={onPointerUp}
                            onDoubleClick={() => setChatWidth(DEFAULT_CHAT)}
                            title="Geser untuk atur ukuran • Klik 2x untuk reset"
                            style={{ touchAction: 'none' }}
                            className={`flex w-2 shrink-0 select-none items-center justify-center transition-colors ${
                                isResizing ? 'bg-blue-500 cursor-col-resize' : 'bg-slate-200 hover:bg-blue-400 cursor-col-resize'
                            }`}
                        >
                            <div className="flex flex-col gap-0.5">
                                <span className="h-1 w-1 rounded-full bg-white/80"></span>
                                <span className="h-1 w-1 rounded-full bg-white/80"></span>
                                <span className="h-1 w-1 rounded-full bg-white/80"></span>
                            </div>
                        </div>

                        <div
                            className={`overflow-hidden bg-white ${
                                isResizing ? '' : 'transition-all duration-300 ease-in-out'
                            }`}
                            style={{ width: chatWidth }}
                        >
                            <div className="h-full" style={{ width: chatWidth }}>
                                <ChatPanel documentId={document.id} onCitation={onCitation} onClose={() => setChatOpen(false)} assistant={assistant} />
                            </div>
                        </div>
                    </>
                )}

                {/* Mobile: SPLIT VIEW vertikal (PDF atas, Chat bawah, resizable) */}
                {isMobile && chatOpen && (
                    <>
                        <div
                            onPointerDown={onPointerDownMobile}
                            onPointerMove={onPointerMoveMobile}
                            onPointerUp={onPointerUp}
                            onDoubleClick={() => setChatHeight(DEFAULT_CHAT_HEIGHT)}
                            title="Geser untuk atur ukuran"
                            style={{ touchAction: 'none' }}
                            className={`flex h-2 shrink-0 select-none items-center justify-center transition-colors ${
                                isResizing ? 'bg-blue-500 cursor-row-resize' : 'bg-slate-200 cursor-row-resize'
                            }`}
                        >
                            <div className="flex gap-0.5">
                                <span className="h-1 w-1 rounded-full bg-white/80"></span>
                                <span className="h-1 w-1 rounded-full bg-white/80"></span>
                                <span className="h-1 w-1 rounded-full bg-white/80"></span>
                            </div>
                        </div>

                        <div
                            className={`shrink-0 overflow-hidden bg-white ${
                                isResizing ? '' : 'transition-all duration-300 ease-in-out'
                            }`}
                            style={{ height: chatHeight }}
                        >
                            <ChatPanel documentId={document.id} onCitation={onCitation} onClose={() => setChatOpen(false)} assistant={assistant} />
                        </div>
                    </>
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
