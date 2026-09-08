import { useEffect, useMemo, useState } from 'react';
import { Link } from '@inertiajs/react';

const PER_PAGE = 6;

const JENIS_LABEL = {
    PERGUB: 'Peraturan Gubernur',
    PERDA: 'Peraturan Daerah',
    KEPGUB: 'Keputusan Gubernur',
};

function DocIcon({ className }) {
    return (
        <svg className={className} fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 12h5.25m-5.25 3h3.75M6.75 21h10.5a2.25 2.25 0 0 0 2.25-2.25V8.25L14.25 3H6.75A2.25 2.25 0 0 0 4.5 5.25v13.5A2.25 2.25 0 0 0 6.75 21Z" />
        </svg>
    );
}

function SparkleIcon({ className }) {
    return (
        <svg className={className} fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3z" />
        </svg>
    );
}

const fmtShort = (t) =>
    t ? new Date(t).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';

export default function Index({ documents }) {
    const [query, setQuery] = useState('');
    const [tahun, setTahun] = useState('SEMUA');
    const [jenis, setJenis] = useState('SEMUA');
    const [status, setStatus] = useState('SEMUA');
    const [urutan, setUrutan] = useState('TERBARU');
    const [page, setPage] = useState(1);
    const [showTop, setShowTop] = useState(false);

    useEffect(() => {
        const onScroll = () => setShowTop(window.scrollY > 400);
        window.addEventListener('scroll', onScroll);
        return () => window.removeEventListener('scroll', onScroll);
    }, []);

    const tahunList = useMemo(
        () => ['SEMUA', ...[...new Set(documents.map((d) => String(d.tahun)))].sort((a, b) => b - a)],
        [documents]
    );
    const jenisList = useMemo(() => ['SEMUA', ...new Set(documents.map((d) => d.jenis))], [documents]);
    const statusList = useMemo(() => ['SEMUA', ...new Set(documents.map((d) => d.status))], [documents]);

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        const arr = documents.filter((d) => {
            const matchQ = !q || d.judul.toLowerCase().includes(q) || String(d.nomor).includes(q);
            const matchT = tahun === 'SEMUA' || String(d.tahun) === tahun;
            const matchJ = jenis === 'SEMUA' || d.jenis === jenis;
            const matchS = status === 'SEMUA' || d.status === status;
            return matchQ && matchT && matchJ && matchS;
        });
        arr.sort((a, b) => {
            const da = new Date(a.tanggal_penetapan || 0).getTime();
            const db = new Date(b.tanggal_penetapan || 0).getTime();
            return urutan === 'TERLAMA' ? da - db : db - da;
        });
        return arr;
    }, [documents, query, tahun, jenis, status, urutan]);

    const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
    const safePage = Math.min(page, totalPages);
    const paged = filtered.slice((safePage - 1) * PER_PAGE, safePage * PER_PAGE);

    const goPage = (p) => {
        setPage(p);
        document.getElementById('hasil')?.scrollIntoView({ behavior: 'smooth' });
    };

    const reset = () => {
        setQuery('');
        setTahun('SEMUA');
        setJenis('SEMUA');
        setStatus('SEMUA');
        setUrutan('TERBARU');
        setPage(1);
    };

    const highlight = (text) => {
        const q = query.trim();
        if (!q) return text;
        const safe = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const parts = text.split(new RegExp(`(${safe})`, 'ig'));
        return parts.map((part, i) =>
            part.toLowerCase() === q.toLowerCase() ? (
                <mark key={i} className="rounded bg-amber-200 px-1 text-slate-900">{part}</mark>
            ) : (
                part
            )
        );
    };

    const selectCls =
        'mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-700 transition focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-100';

    return (
        <div className="min-h-screen bg-[#f5f7fa] text-slate-800">
            {/* ===== HEADER: logo resmi saja (sudah berisi tulisan) ===== */}
            <header className="sticky top-0 z-40 border-b border-slate-200/70 bg-white/95 shadow-sm backdrop-blur">
                <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6 lg:px-8">
                    <img
                        src="https://jdih.jogjaprov.go.id/icon.png"
                        alt="JDIH Daerah Istimewa Yogyakarta"
                        className="h-11 w-auto object-contain sm:h-14"
                    />
                </div>
            </header>

            {/* ===== PANEL PENCARIAN ===== */}
            <section className="mx-auto max-w-7xl px-4 pt-8 sm:px-6 sm:pt-12 lg:px-8">
                <div className="relative overflow-hidden rounded-3xl border border-slate-200/60 bg-white p-6 shadow-sm sm:p-10 lg:p-12">
                    {/* Ilustrasi floating kanan */}
                    <img
                        src="/images/ilustrasi-cari.png"
                        alt=""
                        onError={(e) => (e.currentTarget.style.display = 'none')}
                        className="pointer-events-none absolute right-10 top-10 hidden w-56 lg:block xl:w-64"
                    />

                    <div className="lg:pr-64 xl:pr-72">
                        {/* Breadcrumb */}
                        <nav className="flex flex-wrap items-center gap-2 text-sm text-slate-500">
                            <span className="transition hover:text-blue-600">Beranda</span>
                            <span className="text-slate-300">/</span>
                            <span className="transition hover:text-blue-600">Produk Hukum</span>
                            <span className="text-slate-300">/</span>
                            <span className="font-semibold text-slate-900">Peraturan Perundang-undangan</span>
                        </nav>

                        <h2 className="mt-6 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                            Peraturan Perundang-undangan
                        </h2>
                        <p className="mt-2 text-sm leading-relaxed text-slate-500 sm:text-base">
                            Peraturan tertulis tentang norma hukum di wilayah Daerah Istimewa Yogyakarta
                        </p>

                        {/* Pencarian */}
                        <div className="mt-9">
                            <label htmlFor="q" className="block text-sm font-semibold text-slate-900">
                                Pencarian
                            </label>
                            <input
                                id="q"
                                value={query}
                                onChange={(e) => { setQuery(e.target.value); setPage(1); }}
                                placeholder="Ketik kata kunci"
                                className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3.5 text-sm text-slate-800 placeholder-slate-400 shadow-sm transition focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-100"
                            />
                        </div>

                        {/* Filter */}
                        <div className="mt-7 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                            <div>
                                <label className="block text-sm font-semibold text-slate-900">Tahun</label>
                                <select value={tahun} onChange={(e) => { setTahun(e.target.value); setPage(1); }} className={selectCls}>
                                    {tahunList.map((t) => (
                                        <option key={t} value={t}>{t === 'SEMUA' ? 'Semua tahun' : t}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-slate-900">Kategori</label>
                                <select value={jenis} onChange={(e) => { setJenis(e.target.value); setPage(1); }} className={selectCls}>
                                    {jenisList.map((j) => (
                                        <option key={j} value={j}>{j === 'SEMUA' ? 'Pilih kategori' : JENIS_LABEL[j] ?? j}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-slate-900">Status</label>
                                <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className={selectCls}>
                                    {statusList.map((s) => (
                                        <option key={s} value={s}>{s === 'SEMUA' ? 'Pilih status' : s}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-slate-900">Urutan</label>
                                <select value={urutan} onChange={(e) => { setUrutan(e.target.value); setPage(1); }} className={selectCls}>
                                    <option value="TERBARU">Terbaru</option>
                                    <option value="TERLAMA">Terlama</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* Tombol aksi */}
                    <div className="mt-9 flex flex-wrap items-center gap-3 lg:justify-end">
                        <button
                            onClick={() => document.getElementById('hasil')?.scrollIntoView({ behavior: 'smooth' })}
                            className="flex items-center gap-2 rounded-full bg-blue-600 px-8 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-600/25 transition hover:bg-blue-700 active:scale-[0.98]"
                        >
                            Cari
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-4.35-4.35M17 10.5a6.5 6.5 0 1 1-13 0 6.5 6.5 0 0 1 13 0Z" />
                            </svg>
                        </button>
                        <button
                            onClick={reset}
                            className="rounded-full border border-blue-600 bg-white px-8 py-3 text-sm font-semibold text-blue-600 transition hover:bg-blue-50 active:scale-[0.98]"
                        >
                            Reset
                        </button>
                    </div>
                </div>
            </section>

            {/* ===== HASIL PENELUSURAN ===== */}
            <main id="hasil" className="mx-auto max-w-7xl scroll-mt-24 px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
                <div className="rounded-3xl bg-[#e8f0fe] p-5 sm:p-8 lg:p-10">
                    <div className="flex items-baseline justify-between px-1">
                        <h3 className="text-lg font-bold text-slate-900">Hasil Penelusuran</h3>
                        <span className="text-sm text-slate-500">{filtered.length} dokumen</span>
                    </div>

                    {filtered.length === 0 ? (
                        <div className="mt-6 rounded-2xl border-2 border-dashed border-slate-300 bg-white py-20 text-center">
                            <p className="text-sm text-slate-500 sm:text-base">
                                Tidak ada dokumen yang cocok dengan pencarian Anda.
                            </p>
                        </div>
                    ) : (
                        <>
                            <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2 lg:gap-7">
                                {paged.map((d, i) => (
                                    <div
                                        key={d.id}
                                        style={{ animationDelay: `${i * 60}ms` }}
                                        className="relative flex animate-[fadeIn_0.5s_ease-out_both] flex-col rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md sm:p-7"
                                    >
                                        {/* Tanya AI: pojok kanan atas */}
                                        <Link
                                            href={`/documents/${d.id}/bot`}
                                            title="Tanya Asisten AI"
                                            className="absolute right-5 top-5 flex items-center gap-1.5 rounded-full bg-amber-400 px-3.5 py-1.5 text-xs font-bold text-blue-950 shadow-sm transition hover:bg-amber-300 active:scale-95"
                                        >
                                            <SparkleIcon className="h-3.5 w-3.5" />
                                            Tanya AI
                                        </Link>

                                        <div className="flex items-start gap-4 pr-24">
                                            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-blue-100 bg-blue-50">
                                                <DocIcon className="h-7 w-7 text-blue-600" />
                                            </div>
                                            <div className="min-w-0">
                                                <h4 className="text-base font-bold text-slate-900 sm:text-lg">
                                                    {d.nomor} Tahun {d.tahun}
                                                    <span className="mx-2 text-slate-300">|</span>
                                                    <span className="text-sm font-semibold text-slate-500">{fmtShort(d.tanggal_penetapan)}</span>
                                                </h4>
                                                <div className="mt-2 flex flex-wrap items-center gap-2">
                                                    <span className="text-sm text-slate-600">{JENIS_LABEL[d.jenis] ?? d.jenis}</span>
                                                    <span className={`rounded-full px-3 py-1 text-xs font-medium ${d.status === 'berlaku' ? 'bg-sky-100 text-sky-700' : 'bg-slate-100 text-slate-600'}`}>
                                                        {d.status}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        <p className="mt-5 line-clamp-2 flex-1 text-sm leading-relaxed text-slate-600">
                                            {highlight(d.judul)}
                                        </p>

                                        <div className="mt-6 flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 pt-5">
                                            <a
                                                href={`/documents/${d.id}/pdf`}
                                                target="_blank"
                                                className="flex items-center gap-1.5 rounded-full bg-blue-600 px-5 py-2.5 text-xs font-semibold text-white transition hover:bg-blue-700 active:scale-[0.98]"
                                            >
                                                <span>Download</span>
                                                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v12m0 0 4-4m-4 4-4-4M4 20h16" />
                                                </svg>
                                            </a>
                                            <Link
                                                href={`/documents/${d.id}`}
                                                className="flex items-center gap-1.5 rounded-full border border-blue-600 bg-white px-5 py-2.5 text-xs font-semibold text-blue-600 transition hover:bg-blue-50 active:scale-[0.98]"
                                            >
                                                <span>Selengkapnya</span>
                                                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                                                </svg>
                                            </Link>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Pagination */}
                            {totalPages > 1 && (
                                <div className="mt-10 flex items-center justify-center gap-1.5 overflow-x-auto pb-2">
                                    <button
                                        disabled={safePage === 1}
                                        onClick={() => goPage(safePage - 1)}
                                        className="flex h-10 items-center rounded-full border border-slate-300 bg-white px-4 text-xs font-semibold text-slate-600 transition hover:border-blue-600 hover:text-blue-600 disabled:cursor-not-allowed disabled:opacity-40"
                                    >
                                        ← Prev
                                    </button>
                                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                                        <button
                                            key={p}
                                            onClick={() => goPage(p)}
                                            className={`h-10 w-10 rounded-full text-xs font-bold transition ${
                                                p === safePage
                                                    ? 'bg-blue-600 text-white shadow'
                                                    : 'border border-slate-300 bg-white text-slate-600 hover:border-blue-600 hover:text-blue-600'
                                            }`}
                                        >
                                            {p}
                                        </button>
                                    ))}
                                    <button
                                        disabled={safePage === totalPages}
                                        onClick={() => goPage(safePage + 1)}
                                        className="flex h-10 items-center rounded-full border border-slate-300 bg-white px-4 text-xs font-semibold text-slate-600 transition hover:border-blue-600 hover:text-blue-600 disabled:cursor-not-allowed disabled:opacity-40"
                                    >
                                        Next →
                                    </button>
                                </div>
                            )}

                            <p className="mt-4 text-center text-xs text-slate-500">
                                Halaman {safePage} dari {totalPages} — menampilkan {paged.length} dari {filtered.length} dokumen
                            </p>
                        </>
                    )}
                </div>
            </main>

            {/* ===== FOOTER ===== */}
            <footer className="border-t border-slate-200 bg-white py-8 text-center">
                <p className="text-sm text-slate-500">
                    © {new Date().getFullYear()} JDIH DIY — Didukung asisten AI berbasis RAGFlow
                </p>
            </footer>

            {/* Tombol kembali ke atas */}
            {showTop && (
                <button
                    onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                    title="Kembali ke atas"
                    className="fixed bottom-6 right-6 z-40 flex h-12 w-12 animate-[fadeIn_0.3s_ease-out] items-center justify-center rounded-full bg-blue-600 text-white shadow-lg shadow-blue-600/30 transition hover:bg-blue-700 active:scale-95"
                >
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
                    </svg>
                </button>
            )}
        </div>
    );
}