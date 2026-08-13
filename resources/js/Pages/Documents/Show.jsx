import { useState } from 'react';
import { Link } from '@inertiajs/react';
import PdfViewer from '@/Components/PdfViewer';
import ChatPanel from '@/Components/ChatPanel';

export default function Show({ document }) {
    const [page, setPage] = useState(1);
    const [highlight, setHighlight] = useState(null);

    const onCitation = (ref) => {
        if (!ref?.page) return;
        setHighlight(ref);
        setPage(ref.page);
    };

    return (
        <div className="flex h-screen flex-col">
            <header className="flex items-center gap-3 border-b bg-white px-4 py-3">
                <Link href="/documents" className="text-gray-600 hover:text-blue-600">← Kembali</Link>
                <div>
                    <div className="text-xs font-semibold text-blue-600">
                        {document.jenis} No. {document.nomor}/{document.tahun}
                    </div>
                    <h2 className="line-clamp-1 text-sm font-semibold">{document.judul}</h2>
                </div>
            </header>

            <div className="flex flex-1 overflow-hidden">
                <div className="w-1/2">
                    <PdfViewer url={`/documents/${document.id}/pdf`}
                               page={page} highlight={highlight} onPageChange={setPage} />
                </div>
                <div className="w-1/2 border-l bg-white">
                    <ChatPanel documentId={document.id} onCitation={onCitation} />
                </div>
            </div>
        </div>
    );
}