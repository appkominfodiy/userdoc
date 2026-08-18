import { useEffect, useRef, useState } from 'react';

const CDN = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174';

const MIN_SCALE = 0.5;
const MAX_SCALE = 3;
const AUTO_CAP = 1.4;   // batas zoom mode auto = ukuran baca nyaman
const STEP = 0.2;

export default function PdfViewer({ url, page, highlight, onPageChange }) {
    const canvasRef = useRef(null);
    const scrollRef = useRef(null);
    const pdfRef = useRef(null);
    const renderTaskRef = useRef(null);

    const [numPages, setNumPages] = useState(0);
    const [box, setBox] = useState(null);
    const [ready, setReady] = useState(false);
    const [containerWidth, setContainerWidth] = useState(0);
    const [zoomMode, setZoomMode] = useState('auto'); // 'auto' | 'manual'
    const [manualScale, setManualScale] = useState(1);
    const [displayScale, setDisplayScale] = useState(0);

    // Muat pdf.js
    useEffect(() => {
        if (window.pdfjsLib) { setReady(true); return; }
        const s = document.createElement('script');
        s.src = `${CDN}/pdf.min.js`;
        s.onload = () => {
            window.pdfjsLib.GlobalWorkerOptions.workerSrc = `${CDN}/pdf.worker.min.js`;
            setReady(true);
        };
        document.body.appendChild(s);
    }, []);

    // Muat dokumen
    useEffect(() => {
        if (!ready || !url) return;
        window.pdfjsLib.getDocument(url).promise.then((pdf) => {
            pdfRef.current = pdf;
            setNumPages(pdf.numPages);
        });
    }, [ready, url]);

    // Ukur lebar wadah realtime (buat mode auto + saat resizer di-drag)
    useEffect(() => {
        const el = scrollRef.current;
        if (!el) return;
        let raf = null;
        const ro = new ResizeObserver((entries) => {
            if (raf) cancelAnimationFrame(raf);
            raf = requestAnimationFrame(() => setContainerWidth(entries[0].contentRect.width));
        });
        ro.observe(el);
        return () => { ro.disconnect(); if (raf) cancelAnimationFrame(raf); };
    }, []);

    // Render halaman
    useEffect(() => {
        const pdf = pdfRef.current;
        if (!pdf || !page || !containerWidth) return;
        let cancelled = false;

        pdf.getPage(page).then(async (p) => {
            if (cancelled) return;
            const canvas = canvasRef.current;
            if (!canvas) return;

            const baseVp = p.getViewport({ scale: 1 });
            const padding = 48;
            const available = Math.max(containerWidth - padding, 300);

            // Auto = fit-to-width (dibatasi AUTO_CAP biar nyaman dibaca)
            // Manual = skala pilihan user
            const scale = zoomMode === 'manual'
                ? manualScale
                : Math.min(Math.max(available / baseVp.width, 0.4), AUTO_CAP);

            const vp = p.getViewport({ scale });

            try { renderTaskRef.current?.cancel(); } catch (e) {}
            canvas.height = vp.height;
            canvas.width = vp.width;

            const task = p.render({ canvasContext: canvas.getContext('2d'), viewport: vp });
            renderTaskRef.current = task;
            try {
                await task.promise;
            } catch (e) {
                return; // render dibatalkan saat drag/zoom — normal
            }
            if (cancelled) return;

            setDisplayScale(scale);

            // Highlight sitasi
            if (highlight && highlight.page === page) {
                if ([highlight.x0, highlight.y0, highlight.x1, highlight.y1].every((v) => v !== undefined)) {
                    setBox({
                        left: highlight.x0 * vp.scale,
                        top: highlight.y0 * vp.scale,
                        width: (highlight.x1 - highlight.x0) * vp.scale,
                        height: (highlight.y1 - highlight.y0) * vp.scale,
                    });
                } else {
                    setBox({
                        left: vp.width * 0.1,
                        top: vp.height * 0.3,
                        width: vp.width * 0.8,
                        height: vp.height * 0.4,
                    });
                }
            } else {
                setBox(null);
            }
        });

        return () => { cancelled = true; };
    }, [page, highlight, numPages, ready, containerWidth, zoomMode, manualScale]);

    // Scroll ke highlight
    useEffect(() => {
        if (box && scrollRef.current) {
            scrollRef.current.scrollTo({ top: Math.max(box.top - 150, 0), behavior: 'smooth' });
        }
    }, [box]);

    // ===== Zoom handlers =====
    const changeZoom = (delta) => {
        const base = zoomMode === 'manual' ? manualScale : (displayScale || 1);
        const next = Math.min(Math.max(Math.round((base + delta) * 10) / 10, MIN_SCALE), MAX_SCALE);
        setZoomMode('manual');
        setManualScale(next);
    };
    const zoomAuto = () => setZoomMode('auto');

    const btnCls =
        'flex h-8 w-8 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-600 transition hover:border-blue-600 hover:text-blue-600 disabled:cursor-not-allowed disabled:opacity-40';

    return (
        <div className="flex h-full flex-col bg-slate-100">
            {/* ===== Toolbar ===== */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-white px-3 py-2 sm:px-6 sm:py-2.5">
                {/* Info halaman */}
                <span className="text-sm text-slate-600">
                    Halaman <span className="font-bold text-blue-600">{page}</span>
                    <span className="mx-1 text-slate-300">/</span>
                    {numPages || '…'}
                </span>

                {/* Kontrol zoom */}
                <div className="flex items-center gap-1.5">
                    <button
                        onClick={() => changeZoom(-STEP)}
                        disabled={zoomMode === 'manual' && manualScale <= MIN_SCALE}
                        className={btnCls}
                        title="Perkeil"
                    >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <path strokeLinecap="round" d="M5 12h14" />
                        </svg>
                    </button>

                    <button
                        onClick={zoomAuto}
                        title={zoomMode === 'auto' ? 'Mode otomatis (pas lebar)' : 'Klik untuk kembali ke otomatis'}
                        className={`h-8 min-w-[3.5rem] rounded-lg border px-2 text-xs font-semibold transition ${
                            zoomMode === 'auto'
                                ? 'border-blue-600 bg-blue-50 text-blue-700'
                                : 'border-slate-300 bg-white text-slate-600 hover:border-blue-600 hover:text-blue-600'
                        }`}
                    >
                        {Math.round((displayScale || 1) * 100)}%
                    </button>

                    <button
                        onClick={() => changeZoom(STEP)}
                        disabled={zoomMode === 'manual' && manualScale >= MAX_SCALE}
                        className={btnCls}
                        title="Perbesar"
                    >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <path strokeLinecap="round" d="M12 5v14M5 12h14" />
                        </svg>
                    </button>

                    {zoomMode === 'manual' && (
                        <button
                            onClick={zoomAuto}
                            className="h-8 rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-semibold text-slate-600 transition hover:border-blue-600 hover:text-blue-600"
                            title="Kembali ke ukuran pas-lebar otomatis"
                        >
                            Fit
                        </button>
                    )}
                </div>

                {/* Navigasi halaman */}
                <div className="flex items-center gap-2">
                    <button
                        disabled={page <= 1}
                        onClick={() => onPageChange(page - 1)}
                        className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-blue-600 hover:text-blue-600 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                        ← Prev
                    </button>
                    <button
                        disabled={page >= numPages}
                        onClick={() => onPageChange(page + 1)}
                        className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-blue-600 hover:text-blue-600 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                        Next →
                    </button>
                </div>
            </div>

            {/* ===== Area PDF ===== */}
            <div ref={scrollRef} className="flex-1 overflow-auto p-4 sm:p-6">
                <div className="relative mx-auto w-fit">
                    <canvas ref={canvasRef} className="rounded-sm shadow-lg" />
                    {box && (
                        <div
                            className="pointer-events-none absolute animate-pulse rounded border-4 border-amber-400 bg-amber-300/30 shadow-lg"
                            style={{ left: box.left, top: box.top, width: box.width, height: box.height }}
                        />
                    )}
                </div>
            </div>
        </div>
    );
}