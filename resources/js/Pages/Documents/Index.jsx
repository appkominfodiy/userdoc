import { useMemo, useState } from 'react';
import { Link } from '@inertiajs/react';

const JENIS_LABEL = {
    PERGUB: 'Peraturan Gubernur',
    PERDA: 'Peraturan Daerah',
    KEPGUB: 'Keputusan Gubernur',
};

function ScalesIcon({ className }) {
    return (
        <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10M12 3v18M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2" />
        </svg>
    );
}

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

    const reset = () => {
        setQuery('');
        setTahun('SEMUA');
        setJenis('SEMUA');
        setStatus('SEMUA');
        setUrutan('TERBARU');
    };

    const selectCls =
        'mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm text-slate-700 focus:border-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-100';

    return (
        <div className="min-h-screen bg-slate-100">
            {/* ===== Navbar ===== */}
            <nav className="sticky top-0 z-40 border-b border-slate-200/70 bg-white/80 backdrop-blur">
                <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-950 shadow">
                            <ScalesIcon className="h-5 w-5 text-amber-400" />
                        </div>
                        <div>
                            <h1 className="text-sm font-bold tracking-wide text-slate-900">JDIH DIY</h1>
                            <p className="text-[11px] text-slate-500">Jaringan Dokumentasi & Informasi Hukum</p>
                        </div>
                    </div>
                    <span className="hidden items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-medium text-emerald-700 sm:flex">
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500"></span>
                        Asisten AI aktif
                    </span>
                </div>
            </nav>

            {/* ===== Panel pencarian ala JDIH ===== */}
            <div className="mx-auto max-w-7xl px-4 pt-10 sm:px-6">
                <div className="relative overflow-hidden rounded-3xl border border-slate-200 bg-slate-50 p-8 shadow-sm sm:p-10">
                    <ScalesIcon className="pointer-events-none absolute -right-8 top-1/2 h-64 w-64 -translate-y-1/2 text-blue-950/5" />

                    {/* Breadcrumb */}
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                        <span>Beranda</span>
                        <span className="text-slate-300">/</span>
                        <span>Produk Hukum</span>
                        <span className="text-slate-300">/</span>
                        <span className="font-semibold text-slate-800">Peraturan Perundang-undangan</span>
                    </div>

                    <h2 className="mt-6 text-2xl font-bold text-slate-900">Peraturan Perundang-undangan</h2>
                    <p className="mt-1 text-sm text-slate-600">
                        Peraturan tertulis tentang norma hukum di wilayah Daerah Istimewa Yogyakarta
                    </p>

                    {/* Pencarian */}
                    <div className="mt-6 max-w-3xl">
                        <label className="text-sm font-semibold text-slate-800">Pencarian</label>
                        <input
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Ketik kata kunci"
                            className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-800 placeholder-slate-400 focus:border-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-100"
                        />
                    </div>

                    {/* Filter row */}
                    <div className="mt-6 grid max-w-4xl grid-cols-2 gap-4 lg:grid-cols-4">
                        <div>
                            <label className="text-sm font-semibold text-slate-800">Tahun</label>
                            <select value={tahun} onChange={(e) => setTahun(e.target.value)} className={selectCls}>
                                {tahunList.map((t) => (
                                    <option key={t} value={t}>{t === 'SEMUA' ? 'Semua tahun' : t}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="text-sm font-semibold text-slate-800">Kategori</label>
                            <select value={jenis} onChange={(e) => setJenis(e.target.value)} className={selectCls}>
                                {jenisList.map((j) => (
                                    <option key={j} value={j}>{j === 'SEMUA' ? 'Pilih kategori' : JENIS_LABEL[j] ?? j}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="text-sm font-semibold text-slate-800">Status</label>
                            <select value={status} onChange={(e) => setStatus(e.target.value)} className={selectCls}>
                                {statusList.map((s) => (
                                    <option key={s} value={s}>{s === 'SEMUA' ? 'Pilih status' : s}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="text-sm font-semibold text-slate-800">Urutan</label>
                            <select value={urutan} onChange={(e) => setUrutan(e.target.value)} className={selectCls}>
                                <option value="TERBARU">Terbaru</option>
                                <option value="TERLAMA">Terlama</option>
                            </select>
                        </div>
                    </div>

                    {/* Tombol Cari & Reset */}
                    <div className="mt-7 flex flex-wrap gap-3">
                        <button
                            onClick={() => document.getElementById('hasil')?.scrollIntoView({ behavior: 'smooth' })}
                            className="flex items-center gap-2 rounded-full bg-blue-950 px-8 py-3 text-sm font-semibold text-white shadow transition hover:bg-blue-900"
                        >
                            Cari
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-4.35-4.35M17 10.5a6.5 6.5 0 1 1-13 0 6.5 6.5 0 0 1 13 0Z" />
                            </svg>
                        </button>
                        <button
                            onClick={reset}
                            className="rounded-full border border-blue-950 px-8 py-3 text-sm font-semibold text-blue-950 transition hover:bg-blue-950/5"
                        >
                            Reset
                        </button>
                    </div>
                </div>
            </div>

            {/* ===== Hasil: grid 2 kolom ala JDIH ===== */}
            <main id="hasil" className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
                <div className="rounded-3xl bg-blue-950/5 p-6 sm:p-8">
                    <div className="flex items-center justify-between">
                        <h3 className="text-sm font-bold text-slate-800">Hasil Penelusuran</h3>
                        <span className="text-xs text-slate-500">{filtered.length} dokumen ditemukan</span>
                    </div>

                    {filtered.length === 0 ? (
                        <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-white py-14 text-center text-sm text-slate-500">
                            Tidak ada dokumen yang cocok dengan pencarian Anda.
                        </div>
                    ) : (
                        <div className="mt-6 grid gap-5 md:grid-cols-2">
                            {filtered.map((d, i) => (
                                <div
                                    key={d.id}
                                    style={{ animationDelay: `${Math.min(i, 8) * 60}ms` }}
                                    className="flex animate-[fadeIn_0.5s_ease-out_both] flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                                >
                                    <div className="flex items-start gap-4">
                                        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-50">
                                            <DocIcon className="h-7 w-7 text-blue-900" />
                                        </div>
                                        <div className="min-w-0">
                                            <h4 className="text-base font-bold text-slate-900">
                                                {d.nomor} Tahun {d.tahun}
                                                <span className="mx-2 text-slate-300">|</span>
                                                <span className="font-semibold text-slate-500">{fmtShort(d.tanggal_penetapan)}</span>
                                            </h4>
                                            <div className="mt-1.5 flex flex-wrap items-center gap-2">
                                                <span className="text-sm text-slate-600">{JENIS_LABEL[d.jenis] ?? d.jenis}</span>
                                                <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${d.status === 'berlaku' ? 'bg-sky-100 text-sky-700' : 'bg-slate-100 text-slate-600'}`}>
                                                    {d.status}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    <p className="mt-4 line-clamp-2 text-sm leading-relaxed text-slate-700">{d.judul}</p>

                                    <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
                                        <a
                                            href={`/documents/${d.id}/pdf`}
                                            target="_blank"
                                            className="flex items-center gap-1.5 rounded-full bg-blue-950 px-4 py-2 text-xs font-semibold text-white transition hover:bg-blue-900"
                                        >
                                            Download
                                            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v12m0 0 4-4m-4 4-4-4M4 20h16" />
                                            </svg>
                                        </a>
                                        <Link
                                            href={`/documents/${d.id}`}
                                            className="flex items-center gap-1.5 rounded-full border border-blue-950 px-4 py-2 text-xs font-semibold text-blue-950 transition hover:bg-blue-950/5"
                                        >
                                            Selengkapnya
                                            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                                            </svg>
                                        </Link>
                                        <Link
                                            href={`/documents/${d.id}`}
                                            className="ml-auto flex items-center gap-1.5 rounded-full bg-amber-400 px-4 py-2 text-xs font-bold text-blue-950 shadow-sm transition hover:bg-amber-300"
                                        >
                                            <SparkleIcon className="h-3.5 w-3.5" />
                                            Tanya AI
                                        </Link>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </main>

            <footer className="border-t border-slate-200 bg-white py-6 text-center text-xs text-slate-500">
                © {new Date().getFullYear()} JDIH DIY — Didukung asisten AI berbasis RAGFlow
            </footer>
        </div>
    );
}