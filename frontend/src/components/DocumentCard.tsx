import Link from "next/link";
import type { JdihDocument } from "@/types/document";

export default function DocumentCard({ doc }: { doc: JdihDocument }) {
  const title = doc.judul_peraturan || "Tanpa judul";
  const nomor = doc.nomor;
  const tahun = doc.tahun_terbit;
  const jenis = doc.kategori_hukum_name || "Peraturan";
  const tanggal = doc.tanggal_pengundangan;
  const pdfUrl = doc.file_peraturan;

  return (
    <div className="bg-white text-gray-900 rounded-2xl border border-gray-200 shadow-sm p-5 flex flex-col gap-3 hover:shadow-md transition-shadow">
      <div className="flex items-start gap-3">
        <div className="w-12 h-14 rounded-md bg-blue-50 border border-blue-100 flex items-center justify-center text-2xl shrink-0">
          📄
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-gray-700">
            {nomor ? `Nomor ${nomor} Tahun ${tahun ?? "-"}` : `Tahun ${tahun ?? "-"}`}
          </p>
          {tanggal && <p className="text-xs text-gray-400 mb-1">{tanggal}</p>}
          <span className="inline-block mt-1 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-full px-2.5 py-0.5">
            {jenis}
          </span>
        </div>
      </div>

      {/* Judul ditampilkan penuh, tidak dipotong — dokumen hukum perlu terbaca jelas */}
      <h3 className="text-sm font-semibold leading-snug">{title}</h3>

      {(doc.view_count !== undefined || doc.download_count !== undefined) && (
        <p className="text-xs text-gray-400 flex gap-4">
          {doc.view_count !== undefined && <span>👁 {doc.view_count} dilihat</span>}
          {doc.download_count !== undefined && <span>⬇ {doc.download_count} diunduh</span>}
        </p>
      )}

      <div className="flex gap-2 mt-auto pt-2">
        {pdfUrl && (
          <a
            href={pdfUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 text-center text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg py-2 font-medium transition-colors"
          >
            Download
          </a>
        )}
        <Link
          href={`/documents/${doc.doc_id}?slug=${encodeURIComponent(doc.slug)}`}
          className="flex-1 text-center text-sm border border-blue-300 text-blue-700 hover:bg-blue-50 rounded-lg py-2 font-medium transition-colors"
        >
          Selengkapnya
        </Link>
      </div>
    </div>
  );
}