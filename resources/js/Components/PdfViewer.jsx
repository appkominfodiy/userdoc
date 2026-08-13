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

            setBox(highlight && highlight.page === page ? {
                left: highlight.x0 * vp.scale,
                top: highlight.y0 * vp.scale,
                width: (highlight.x1 - highlight.x0) * vp.scale,
                height: (highlight.y1 - highlight.y0) * vp.scale,
            } : null);
        });
    }, [page, highlight, numPages, ready]);

    useEffect(() => {
        if (box && scrollRef.current) {
            scrollRef.current.scrollTo({ top: Math.max(box.top - 150, 0), behavior: 'smooth' });
        }
    }, [box]);

    return (
        <div className="flex h-full flex-col">
            <div className="flex items-center justify-between bg-gray-800 px-4 py-2 text-sm text-white">
                <span>Halaman: {page} / {numPages || '…'}</span>
                <div className="flex gap-2">
                    <button disabled={page <= 1} onClick={() => onPageChange(page - 1)}
                            className="rounded bg-gray-700 px-2 py-1 disabled:opacity-40">← Prev</button>
                    <button disabled={page >= numPages} onClick={() => onPageChange(page + 1)}
                            className="rounded bg-gray-700 px-2 py-1 disabled:opacity-40">Next →</button>
                </div>
            </div>

            <div ref={scrollRef} className="flex-1 overflow-auto bg-gray-200 p-4">
                <div className="relative mx-auto w-fit">
                    <canvas ref={canvasRef} className="shadow-lg" />
                    {box && (
                        <div className="pointer-events-none absolute animate-pulse border-2 border-yellow-500 bg-yellow-300/40"
                             style={{ left: box.left, top: box.top, width: box.width, height: box.height }} />
                    )}
                </div>
            </div>
        </div>
    );
}