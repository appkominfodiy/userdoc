import { useState, useEffect } from 'react';
import { Link } from '@inertiajs/react';

const JENIS_LABEL = {
    PERGUB: 'Peraturan Gubernur',
    PERDA: 'Peraturan Daerah',
    KEPGUB: 'Keputusan Gubernur',
};

const fmtLong = (t) =>
    t ? new Date(t).toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '-') : '-';

export default function Show({ document }) {
    const [showTop, setShowTop] = useState(false);

    useEffect(() => {
        const onScroll = () => setShowTop(window.scrollY > 100);
        window.addEventListener('scroll', onScroll);
        return () => window.removeEventListener('scroll', onScroll);
    }, []);

    const shortTitle = `${JENIS_LABEL[document.jenis] ?? document.jenis} Daerah Istimewa Yogyakarta Nomor ${document.nomor} Tahun ${document.tahun} Tentang ${document.judul}`;

    return (
        <div className="min-h-screen bg-[#f5f7fa] text-slate-800 pb-20">
            {/* Header / Navbar placeholder (Assuming similar to Index.jsx or layout) */}
            <header className="sticky top-0 z-40 border-b border-slate-200/70 bg-white/95 shadow-sm backdrop-blur">
                <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6 lg:px-8 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <img
                            src="https://jdih.jogjaprov.go.id/icon.png"
                            alt="JDIH DIY"
                            className="h-9 w-auto object-contain sm:h-11"
                        />
                    </div>
                    {/* Placeholder for top nav links */}
                    <div className="hidden lg:flex items-center gap-6 text-sm font-medium text-slate-700">
                        <Link href="/documents" className="hover:text-blue-600">Beranda</Link>
                        <span className="cursor-pointer hover:text-blue-600">Dokumen Hukum ▾</span>
                        <span className="cursor-pointer hover:text-blue-600">Dokumen Pembentukan PUU ▾</span>
                        <span className="cursor-pointer hover:text-blue-600">Layanan ▾</span>
                    </div>
                </div>
            </header>

            <main className="mx-auto max-w-7xl px-4 pt-8 sm:px-6 lg:px-8">
                {/* Banner Section */}
                <div className="relative overflow-hidden rounded-3xl border border-slate-200/60 bg-white p-6 shadow-sm sm:p-10 lg:p-10 flex flex-col md:flex-row gap-8 items-start md:items-center">
                    <div className="flex-1">
                        <div className="mb-4">
                            <Link href="/documents" className="inline-flex items-center gap-2 rounded-full bg-blue-500 px-4 py-1.5 text-sm font-semibold text-white shadow hover:bg-blue-600 transition">
                                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                                </svg>
                                Kembali
                            </Link>
                        </div>
                        
                        {/* Breadcrumb */}
                        <nav className="flex flex-wrap items-center gap-2 text-sm text-slate-500 mb-6">
                            <Link href="/documents" className="transition hover:text-blue-600">Beranda</Link>
                            <span className="text-slate-300">/</span>
                            <span className="transition hover:text-blue-600">Produk Hukum</span>
                            <span className="text-slate-300">/</span>
                            <span className="transition hover:text-blue-600">Peraturan Perundang-undangan</span>
                            <span className="text-slate-300">/</span>
                            <span className="font-semibold text-slate-900">Detail Perundang-undangan</span>
                        </nav>

                        <h2 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl leading-snug">
                            {shortTitle}
                        </h2>
                        
                        <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-slate-600">
                            <span>{document.tahun} Tahun {document.tahun}</span>
                            <span className="text-slate-300">|</span>
                            <span>{fmtLong(document.tanggal_penetapan)}</span>
                            <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                                document.status === 'berlaku' ? 'bg-sky-100 text-sky-700' : 'bg-slate-100 text-slate-600'
                            }`}>
                                {document.status === 'berlaku' ? 'Berlaku' : document.status}
                            </span>
                        </div>
                    </div>

                    <div className="shrink-0 flex flex-col items-center gap-4">
                        <img 
                            src="/images/ilustrasi-cari.png" 
                            alt="Ilustrasi" 
                            className="w-32 md:w-40 object-contain hidden md:block" 
                            onError={(e) => { e.currentTarget.style.display = 'none'; }}
                        />
                        <a
                            href={`/documents/${document.id}/pdf`}
                            target="_blank"
                            className="flex items-center gap-2 rounded-full bg-blue-500 px-8 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-500/30 transition hover:bg-blue-600 active:scale-95 w-full justify-center"
                        >
                            Download
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                            </svg>
                        </a>
                    </div>
                </div>

                {/* Content Layout */}
                <div className="mt-8 flex flex-col lg:flex-row gap-8">
                    {/* Left Column (Details) */}
                    <div className="flex-1 rounded-3xl border border-slate-200/60 bg-white p-6 sm:p-10 shadow-sm">
                        <div className="space-y-4 sm:space-y-6 text-sm text-slate-700">
                            {[
                                { label: 'Judul Peraturan', value: document.judul },
                                { label: 'Tahun Terbit', value: document.tahun },
                                { label: 'Nomor', value: document.nomor },
                                { label: 'Jenis Peraturan', value: document.jenis },
                                { label: 'Singkatan Jenis Peraturan', value: document.jenis },
                                { label: 'Tanggal Penetapan', value: fmtLong(document.tanggal_penetapan) },
                                { label: 'Tanggal Pengundangan', value: fmtLong(document.tanggal_pengundangan) },
                                { label: 'Penandatangan', value: document.penandatangan },
                                { label: 'Pemrakarsa', value: document.pemrakarsa },
                                { label: 'Sumber', value: document.sumber },
                                { label: 'TEU Badan', value: document.teu_badan },
                                { label: 'Tempat Penetapan', value: document.tempat_penetapan },
                                { label: 'Lokasi', value: document.lokasi },
                                { label: 'Bahasa', value: document.bahasa },
                                { label: 'Bidang Hukum', value: document.bidang_hukum },
                                { label: 'Urusan Pemerintahan', value: document.urusan_pemerintahan },
                                { label: 'Subjek', value: document.subjek },
                                { label: 'Peraturan Terkait', value: document.peraturan_terkait, isHtml: true },
                                { label: 'Dokumen Terkait', value: document.dokumen_terkait, isHtml: true },
                                { label: 'Status Peraturan', value: document.status },
                                { label: 'Keterangan Status', value: document.keterangan_status, isHtml: true },
                            ].map((row, idx) => (
                                <div key={idx} className="grid grid-cols-1 md:grid-cols-[250px_1fr] gap-1 md:gap-4">
                                    <span className="font-medium text-slate-500">{row.label}</span>
                                    <span className="text-slate-900">
                                        <span className="hidden md:inline mr-2">:</span>
                                        {row.isHtml ? (
                                            <div dangerouslySetInnerHTML={{ __html: row.value || '-' }} className="inline-block prose prose-sm prose-slate max-w-none" />
                                        ) : (
                                            row.value || '-'
                                        )}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Right Column (Files & QR) */}
                    <div className="w-full lg:w-[400px] shrink-0 space-y-6">
                        {/* QR Box */}
                        <div className="rounded-3xl border border-slate-200/60 bg-white p-8 shadow-sm flex flex-col items-center justify-center">
                            <div className="h-48 w-48 bg-slate-100 rounded flex items-center justify-center border border-slate-200 p-2">
                                {/* Placeholder for actual QR code logic. Using a simulated grid for now */}
                                <div className="grid grid-cols-8 gap-1 w-full h-full opacity-60">
                                    {Array.from({length: 64}).map((_, i) => (
                                        <div key={i} className={`bg-slate-800 ${Math.random() > 0.5 ? 'opacity-100' : 'opacity-0'}`}></div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* File Cards */}
                        <div className="rounded-3xl border border-slate-200/60 bg-white p-6 shadow-sm space-y-4">
                            <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-4">
                                <div className="flex items-start gap-3">
                                    <svg className="h-6 w-6 text-blue-500 shrink-0" fill="currentColor" viewBox="0 0 24 24">
                                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm-1 2.5L17.5 9H13V4.5zM6 20V4h5v7h7v9H6z"/>
                                    </svg>
                                    <div>
                                        <h4 className="font-bold text-slate-800 text-sm">File Abstrak</h4>
                                        <p className="text-xs text-slate-500 mt-0.5 italic">Mohon maaf berkas belum tersedia</p>
                                    </div>
                                </div>
                            </div>
                            <div className="rounded-xl border border-slate-200 bg-white p-4">
                                <div className="flex items-start gap-3">
                                    <svg className="h-6 w-6 text-blue-500 shrink-0" fill="currentColor" viewBox="0 0 24 24">
                                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm-1 2.5L17.5 9H13V4.5zM6 20V4h5v7h7v9H6z"/>
                                    </svg>
                                    <div>
                                        <h4 className="font-bold text-slate-800 text-sm">Naskah Bahasa Inggris</h4>
                                        <p className="text-xs text-slate-500 mt-0.5 italic">Mohon maaf berkas belum tersedia</p>
                                    </div>
                                </div>
                            </div>
                            <div className="rounded-xl border border-slate-200 bg-white p-4">
                                <div className="flex items-start gap-3">
                                    <svg className="h-6 w-6 text-blue-500 shrink-0" fill="currentColor" viewBox="0 0 24 24">
                                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm-1 2.5L17.5 9H13V4.5zM6 20V4h5v7h7v9H6z"/>
                                    </svg>
                                    <div>
                                        <h4 className="font-bold text-slate-800 text-sm">Naskah Akademik</h4>
                                        <p className="text-xs text-slate-500 mt-0.5 italic">Mohon maaf berkas belum tersedia</p>
                                    </div>
                                </div>
                            </div>
                            <div className="rounded-xl border border-blue-200 bg-white p-4">
                                <div className="flex items-start gap-3">
                                    <svg className="h-6 w-6 text-blue-500 shrink-0" fill="currentColor" viewBox="0 0 24 24">
                                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm-1 2.5L17.5 9H13V4.5zM6 20V4h5v7h7v9H6z"/>
                                    </svg>
                                    <div>
                                        <h4 className="font-bold text-slate-800 text-sm mb-2">Rancangan</h4>
                                        <a href={`/documents/${document.id}/pdf`} target="_blank" className="inline-flex items-center gap-1.5 rounded-full bg-blue-100 text-blue-700 px-4 py-1.5 text-xs font-semibold hover:bg-blue-200 transition">
                                            Download
                                            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                                            </svg>
                                        </a>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </main>

            {/* Floating Buttons: Back to top & AI Bot */}
            <div className="fixed bottom-6 right-6 z-50 flex items-end gap-3">
                {/* Back to Top */}
                {showTop && (
                    <button
                        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                        title="Kembali ke atas"
                        className="flex h-12 w-12 animate-[fadeIn_0.3s_ease-out] items-center justify-center rounded-full bg-blue-500 text-white shadow-lg shadow-blue-500/30 transition hover:bg-blue-600 active:scale-95"
                    >
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
                        </svg>
                    </button>
                )}

                {/* AI Bot Button (Animated Pulse) */}
                <Link
                    href={`/documents/${document.id}/bot`}
                    title="Tanya Asisten AI"
                    className="relative flex h-14 w-14 items-center justify-center rounded-full bg-blue-600 shadow-xl shadow-blue-600/30 transition-transform hover:scale-105 active:scale-95 group"
                >
                    <div className="absolute inset-0 rounded-full bg-blue-400 opacity-50 animate-ping group-hover:animate-none"></div>
                    {/* Bot / Brain Icon */}
                    <svg className="h-7 w-7 text-white relative z-10" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 2a2 2 0 0 1 2 2v2a2 2 0 0 1 2 2h2a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2h-2v1a3 3 0 0 1-3 3H9a3 3 0 0 1-3-3v-1H4a2 2 0 0 1-2-2v-6a2 2 0 0 1 2-2h2a2 2 0 0 1 2-2V4a2 2 0 0 1 2-2h2zm0 2h-2v2h2V4zm2 6H6v6h12v-6h-2v-2H8v2zm-4 2h2v2h-2v-2z" />
                    </svg>
                    {/* Small inner indicator matching the screenshot (purple circle) */}
                    <div className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-purple-500 shadow-sm z-20">
                        <svg className="h-3 w-3 text-white" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                    </div>
                </Link>
            </div>
        </div>
    );
}
