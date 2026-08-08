"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { fetchDocumentList } from "@/lib/api";
import type { JdihDocument } from "@/types/document";

export default function HomePage() {
  const router = useRouter();

  const [documents, setDocuments] = useState<JdihDocument[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState<number | null>(1);
  const [totalItems, setTotalItems] = useState<number | null>(0);
  const [hasNext, setHasNext] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedYear, setSelectedYear] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");

  const years = Array.from({ length: 2026 - 1951 + 1 }, (_, i) => (2026 - i).toString());

  const categories = [
    "Peraturan Daerah",
    "Peraturan Gubernur",
    "Keputusan Gubernur",
    "Peraturan Bersama",
    "Instruksi Gubernur",
    "Surat Edaran",
  ];

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchDocumentList(currentPage, {
          search: searchQuery,
          year: selectedYear,
          category: selectedCategory,
        });
        setDocuments(data.documents || []);
        // total_page BISA null (saat filter kategori aktif — backend sengaja
        // tidak menghitung total pasti karena mahal). Simpan apa adanya,
        // JANGAN di-fallback ke 1 — itu yang kemarin nyembunyiin pagination.
        setTotalPages(data.total_page ?? null);
        setTotalItems(data.total_item ?? null);
        setHasNext(Boolean(data.has_next));
      } catch (err) {
        console.error("Failed:", err);
        setError("Gagal memuat dokumen.");
      } finally {
        setLoading(false);
      }
    };

    const timer = setTimeout(() => {
      loadData();
    }, 300);

    return () => clearTimeout(timer);
  }, [currentPage, searchQuery, selectedYear, selectedCategory]);

  // Reset ke halaman 1 setiap kali filter berubah (bukan currentPage yang berubah)
  useEffect(() => {
    setCurrentPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, selectedYear, selectedCategory]);

  const showPagination = currentPage > 1 || hasNext;

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white border-b-2 border-gray-300 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
          <div className="flex items-center gap-3">
            <span className="text-4xl">⚖️</span>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">JDIH Daerah Istimewa Yogyakarta</h1>
              <p className="text-base text-gray-700 mt-1">Jaringan Dokumentasi dan Informasi Hukum</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <div className="bg-white rounded-lg border-2 border-gray-300 p-6 mb-6 shadow-md">
          <div className="mb-4">
            <label className="block text-sm font-bold text-gray-800 mb-2">🔍 Pencarian</label>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari judul, nomor, atau kata kunci..."
              className="w-full px-4 py-3 border-2 border-gray-400 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600 text-gray-900 placeholder-gray-500 font-medium"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-bold text-gray-800 mb-2">📅 Tahun</label>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                className="w-full px-3 py-2.5 border-2 border-gray-400 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600 bg-white text-gray-900 font-medium"
              >
                <option value="">Semua Tahun</option>
                {years.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-800 mb-2">📂 Kategori</label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full px-3 py-2.5 border-2 border-gray-400 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600 bg-white text-gray-900 font-medium"
              >
                <option value="">Semua Kategori</option>
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-end">
              <button
                onClick={() => {
                  setSearchQuery("");
                  setSelectedYear("");
                  setSelectedCategory("");
                  setCurrentPage(1);
                }}
                className="w-full px-4 py-2.5 bg-gray-200 hover:bg-gray-300 text-gray-900 rounded-md transition-colors text-sm font-bold border-2 border-gray-400"
              >
                🔄 Reset Filter
              </button>
            </div>
          </div>
        </div>

        {loading && (
          <div className="text-center py-12">
            <div className="animate-spin h-10 w-10 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-3"></div>
            <p className="text-gray-800 font-bold">Memuat dokumen...</p>
          </div>
        )}

        {error && (
          <div className="bg-red-100 border-2 border-red-400 rounded-lg p-4 mb-6">
            <p className="text-red-900 font-bold">{error}</p>
          </div>
        )}

        {!loading && !error && documents.length > 0 && (
          <>
            {totalItems !== null && (
              <p className="text-sm text-gray-600 mb-4">
                Menampilkan halaman {currentPage}
                {totalPages !== null ? ` dari ${totalPages}` : ""} — {totalItems} total dokumen
                {selectedCategory && ` untuk kategori "${selectedCategory}"`}
              </p>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {documents.map((doc, idx) => (
                <div
                  key={`${doc.id}-${idx}`}
                  className="bg-white rounded-lg border-2 border-gray-300 p-5 hover:shadow-lg hover:border-blue-500 transition-all cursor-pointer"
                  onClick={() => router.push(`/documents/${doc.doc_id}?slug=${doc.slug}`)}
                >
                  <div className="flex items-start justify-between mb-3">
                    <span className="inline-flex items-center px-2.5 py-1 rounded text-xs font-bold bg-blue-100 text-blue-900 border border-blue-300">
                      {doc.kategori_hukum_name || "Peraturan"}
                    </span>
                    <span className="text-xs font-bold text-gray-900 bg-gray-200 px-2.5 py-1 rounded border border-gray-400">
                      {doc.tahun_terbit || "N/A"}
                    </span>
                  </div>
                  <h3 className="text-sm font-bold text-gray-900 mb-3 line-clamp-3 leading-relaxed">
                    {doc.judul_peraturan}
                  </h3>
                  <div className="flex items-center justify-between text-xs text-gray-700 font-medium pt-3 border-t-2 border-gray-200">
                    <span>👁 {doc.view_count || 0} dilihat</span>
                    <span>📥 {doc.download_count || 0} diunduh</span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {!loading && !error && documents.length === 0 && (
          <div className="text-center py-12 bg-white rounded-lg border-2 border-gray-300">
            <p className="text-gray-800 font-bold mb-2">Tidak ada dokumen ditemukan</p>
            <button
              onClick={() => {
                setSearchQuery("");
                setSelectedYear("");
                setSelectedCategory("");
                setCurrentPage(1);
              }}
              className="text-blue-700 hover:underline text-sm font-bold"
            >
              Reset Filter
            </button>
          </div>
        )}

        {!loading && !error && showPagination && (
          <div className="flex items-center justify-center gap-2 mt-8">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-4 py-2 border-2 border-gray-400 rounded-md disabled:opacity-40 text-sm font-bold bg-white hover:bg-gray-100 text-gray-900"
            >
              ← Prev
            </button>
            <span className="text-sm text-gray-900 font-bold">
              Hal {currentPage}
              {totalPages !== null ? ` dari ${totalPages}` : ""}
            </span>
            <button
              onClick={() => setCurrentPage((p) => p + 1)}
              disabled={!hasNext}
              className="px-4 py-2 border-2 border-gray-400 rounded-md disabled:opacity-40 text-sm font-bold bg-white hover:bg-gray-100 text-gray-900"
            >
              Next →
            </button>
          </div>
        )}
      </main>
    </div>
  );
}