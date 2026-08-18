import { useEffect, useRef, useState } from 'react';

const CDN = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174';

export default function PdfViewer({ url, page, highlight, onPageChange }) {
    const canvasRef = useRef(null);
    const scrollRef = useRef(null);
    const pdfRef = useRef(null);
    const [numPages, setNumPages] = useState(0);
    const [box, setBox] = useState(null);
    const [ready, setReady] = useState(false);

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

    useEffect(() => {
        if (!ready || !url) return;
        window.pdfjsLib.getDocument(url).promise.then((pdf) => {
            pdfRef.current = pdf;
            setNumPages(pdf.numPages);
        });
    }, [ready, url]);

    useEffect(() => {
        const pdf = pdfRef.current;
        if (!pdf || !page) return;

        pdf.getPage(page).then(async (p) => {
            const canvas = canvasRef.current;
            if (!canvas) return;
            const vp = p.getViewport({ scale: 1.3 });
            canvas.height = vp.height;
            canvas.width = vp.width;
            await p.render({ canvasContext: canvas.getContext('2d'), viewport: vp }).promise;

            if (highlight && highlight.page === page) {
                if (highlight.x0 !== undefined && highlight.y0 !== undefined &&
                    highlight.x1 !== undefined && highlight.y1 !== undefined) {
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
    }, [page, highlight, numPages, ready]);

    useEffect(() => {
        if (box && scrollRef.current) {
            scrollRef.current.scrollTo({ top: Math.max(box.top - 150, 0), behavior: 'smooth' });
        }
    }, [box]);

    return (
        <div className="flex h-full flex-col bg-slate-100">
            <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-2.5 sm:px-6">
                <span className="text-sm text-slate-600">
                    Halaman <span className="font-bold text-blue-600">{page}</span>
                    <span className="mx-1 text-slate-300">/</span>
                    {numPages || '…'}
                </span>
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