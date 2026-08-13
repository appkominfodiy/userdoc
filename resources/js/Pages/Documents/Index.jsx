import { Link } from '@inertiajs/react';

export default function Index({ documents }) {
    return (
        <div className="mx-auto max-w-4xl px-4 py-8">
            <h1 className="mb-2 text-2xl font-bold">Produk Hukum DIY</h1>
            <p className="mb-6 text-sm text-gray-500">{documents.length} dokumen tersinkron dari JDIH</p>

            <div className="space-y-3">
                {documents.map((d) => (
                    <Link key={d.id} href={`/documents/${d.id}`}
                          className="block rounded-lg border-l-4 border-blue-500 bg-white p-4 shadow hover:shadow-md">
                        <div className="flex items-center gap-2 text-xs font-semibold text-blue-600">
                            <span>{d.jenis} No. {d.nomor} Tahun {d.tahun}</span>
                            <span className="rounded bg-gray-100 px-2 py-0.5 text-[10px] text-gray-600">
                                {d.sync_status}
                            </span>
                        </div>
                        <div className="mt-1 font-semibold text-gray-900">{d.judul}</div>
                        <div className="mt-2 text-sm text-gray-500">
                            Ditetapkan: {d.tanggal_penetapan} · Status: {d.status}
                        </div>
                    </Link>
                ))}
            </div>
        </div>
    );
}