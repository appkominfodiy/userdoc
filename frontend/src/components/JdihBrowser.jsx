import { useState, useEffect, useCallback } from 'react'
import { api } from '../api'

const KATEGORI_OPTIONS = [
  { value: '', label: 'Semua kategori' },
  { value: 1, label: 'Peraturan Daerah' },
  { value: 2, label: 'Peraturan Gubernur' },
  { value: 3, label: 'Keputusan Gubernur' },
  { value: 4, label: 'Ijin Gubernur' },
  { value: 5, label: 'Keputusan Sekda' },
  { value: 6, label: 'Pembentukan Tim' },
  { value: 7, label: 'Pembentukan Panitia' },
  { value: 8, label: 'Peraturan Daerah Istimewa' },
  { value: 9, label: 'Undang-Undang' },
  { value: 10, label: 'Peraturan Presiden' },
  { value: 11, label: 'Instruksi Presiden' },
  { value: 12, label: 'Peraturan Pemerintah' },
  { value: 13, label: 'Keputusan Presiden' },
  { value: 15, label: 'Surat Edaran' },
  { value: 16, label: 'Instruksi Gubernur' },
  { value: 17, label: 'Propemperda' },
  { value: 19, label: 'Peraturan Menteri' },
]

const STATUS_OPTIONS = [
  { value: '', label: 'Semua status' },
  { value: 1, label: 'Berlaku' },
  { value: 2, label: 'Tidak Berlaku' },
  { value: 3, label: 'Tidak Diketahui' },
]

const ORDER_OPTIONS = [
  { value: '-tanggal_pengundangan', label: 'Terbaru' },
  { value: 'tanggal_pengundangan', label: 'Terlama' },
]

function JdihBrowser({ onSelectDocument }) {
  const [search, setSearch] = useState('')
  const [tahun, setTahun] = useState('')
  const [kategori, setKategori] = useState('')
  const [status, setStatus] = useState('')
  const [order, setOrder] = useState('-tanggal_pengundangan')
  const [page, setPage] = useState(1)

  const [results, setResults] = useState([])
  const [paging, setPaging] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [selectingId, setSelectingId] = useState(null)

  const fetchResults = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const params = { page, size: 10, order }
      if (search) params.search = search
      if (tahun) params.tahun = tahun
      if (kategori) params.kategori_hukum_id = kategori
      if (status) params.status_produk_hukum = status

      const res = await api.get('/jdih/list', { params })
      setResults(res.data.data || [])
      setPaging(res.data.paging)
    } catch (err) {
      console.error(err)
      setError('Gagal mengambil data dari JDIH.')
      setResults([])
      setPaging(null)
    } finally {
      setLoading(false)
    }
  }, [page, order, search, tahun, kategori, status])

useEffect(() => {
  Promise.resolve().then(() => {
    fetchResults()
  })
}, [fetchResults])

  function handleSearchSubmit(e) {
    e.preventDefault()
    setPage(1)
    fetchResults()
  }

  function handleReset() {
    setSearch('')
    setTahun('')
    setKategori('')
    setStatus('')
    setOrder('-tanggal_pengundangan')
    setPage(1)
    fetchResults()
  }

  async function handleSelect(doc) {
    setSelectingId(doc.id)
    setError('')
    try {
      const selectRes = await api.post(
        `/jdih/select/${doc.id}`,
        null,
        { params: { file_url: doc.file_peraturan } }
      )
      const documentId = selectRes.data.document_id

      if (!selectRes.data.already_processed) {
        await api.post('/ingest', { document_id: documentId })
      }

      onSelectDocument(documentId)
    } catch (err) {
      console.error(err)
      setError('Gagal memproses dokumen ini. Coba dokumen lain.')
    } finally {
      setSelectingId(null)
    }
  }

  return (
    <div className="h-full flex flex-col bg-amber-50">
      <div className="flex-1 overflow-y-auto">
      <form onSubmit={handleSearchSubmit} className="flex-shrink-0">
        <div className="bg-gradient-to-r from-red-900 to-red-800 px-5 sm:px-8 pt-8 sm:pt-10 pb-16 overflow-auto">
          <h2 className="text-white text-xl sm:text-2xl font-bold leading-tight">
            Peraturan Perundang-undangan
          </h2>
          <p className="text-blue-100 text-sm mt-1">
            Peraturan tertulis tentang norma hukum di wilayah Daerah Istimewa Yogyakarta
          </p>
        </div>

        <div className="px-5 sm:px-8 -mt-12 pb-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-100 p-4 sm:p-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
              <label className="block">
                <span className="block text-xs font-semibold text-slate-600 mb-1.5">Pencarian</span>
                <div className="relative">
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Ketik kata kunci pencarian"
                    className="w-full border border-slate-200 rounded-lg pl-3 pr-9 py-2.5 text-sm focus:outline-none focus:border-[#6366F1] focus:shadow-[0_4px_12px_rgba(99,102,241,0.12)] transition"
                  />
                  <button
                    type="submit"
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-[#043BAC]"
                    aria-label="Cari"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 10.5a6.5 6.5 0 11-13 0 6.5 6.5 0 0113 0z" />
                    </svg>
                  </button>
                </div>
              </label>

              <label className="block">
                <span className="block text-xs font-semibold text-slate-600 mb-1.5">Tahun</span>
                <select
                  value={tahun}
                  onChange={(e) => { setTahun(e.target.value); setPage(1) }}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm bg-white focus:outline-none focus:border-[#6366F1] focus:shadow-[0_4px_12px_rgba(99,102,241,0.12)] transition"
                >
                  <option value="">Ketik tahun</option>
                  {Array.from({ length: 10 }, (_, i) => 2026 - i).map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="block text-xs font-semibold text-slate-600 mb-1.5">Kategori</span>
                <select
                  value={kategori}
                  onChange={(e) => { setKategori(e.target.value); setPage(1) }}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm bg-white focus:outline-none focus:border-[#6366F1] focus:shadow-[0_4px_12px_rgba(99,102,241,0.12)] transition"
                >
                  {KATEGORI_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="block text-xs font-semibold text-slate-600 mb-1.5">Status</span>
                <select
                  value={status}
                  onChange={(e) => { setStatus(e.target.value); setPage(1) }}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm bg-white focus:outline-none focus:border-[#6366F1] focus:shadow-[0_4px_12px_rgba(99,102,241,0.12)] transition"
                >
                  {STATUS_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="block text-xs font-semibold text-slate-600 mb-1.5">Urutan</span>
                <select
                  value={order}
                  onChange={(e) => { setOrder(e.target.value); setPage(1) }}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm bg-white focus:outline-none focus:border-[#6366F1] focus:shadow-[0_4px_12px_rgba(99,102,241,0.12)] transition"
                >
                  {ORDER_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </label>
            </div>

            <div className="flex justify-end gap-2 mt-5">
              <button
                type="button"
                onClick={handleReset}
                className="px-6 py-2.5 rounded-lg border border-slate-300 text-slate-600 text-sm font-medium hover:bg-slate-50 hover:border-slate-400 transition"
              >
                Reset
              </button>
              <button
                type="submit"
                className="px-6 py-2.5 rounded-lg bg-red-800 hover:bg-red-700 text-white text-sm font-medium shadow-sm transition disabled:opacity-40"
              >
                Cari
              </button>
            </div>
          </div>
        </div>
      </form>

      <div className="p-5 sm:p-8 pt-2 space-y-3">
        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg p-3">
            {error}
          </p>
        )}

        {loading && (
          <p className="text-sm text-slate-400 text-center py-8">Memuat...</p>
        )}

        {!loading && results.length === 0 && !error && (
          <p className="text-sm text-slate-400 text-center py-8">
            Tidak ada dokumen yang cocok dengan pencarian.
          </p>
        )}

        {!loading && results.map((doc) => (
          <div key={doc.id} className="bg-white rounded-lg border border-slate-200 shadow-sm p-4 sm:p-5 flex gap-4 hover:shadow-md transition">
            <div className="flex-shrink-0 w-12 h-12 sm:w-14 sm:h-14 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center">
              <img src="/illus-paper.svg" alt="Dokumen" className="w-10 h-10 sm:w-11 sm:h-11 object-contain" />
            </div>

            <div className="flex-1 min-w-0 space-y-1.5">
              <p className="text-xs text-slate-500">
                {doc.judul_lama}
                {doc.tanggal_pengundangan ? ` | ${doc.tanggal_pengundangan}` : ''}
              </p>

              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="font-medium text-slate-700">{doc.kategori_hukum_name}</span>
                <span
                  className={`px-2 py-0.5 rounded-full ${
                    doc.status_produk_hukum === '1'
                      ? 'bg-green-50 text-green-700'
                      : doc.status_produk_hukum === '2'
                      ? 'bg-red-50 text-red-700'
                      : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {doc.status_produk_hukum === '1'
                    ? 'Berlaku'
                    : doc.status_produk_hukum === '2'
                    ? 'Tidak Berlaku'
                    : 'Tidak Diketahui'}
                </span>
              </div>

              <h3 className="font-semibold text-slate-800 text-sm leading-snug">
                {doc.judul_peraturan}
              </h3>

              <p className="text-xs text-slate-400">
                {doc.view_count ?? 0} dilihat · {doc.download_count ?? 0} diunduh
              </p>

              <div className="flex gap-2 pt-1.5">
                <a
                  href={doc.file_peraturan}
                  target="_blank"
                  rel="noreferrer"
                  className="px-5 py-2 rounded-lg border border-slate-300 text-slate-600 text-sm font-medium hover:bg-slate-50 hover:border-slate-400 transition"
                >
                  Download
                </a>
                <button
                  onClick={() => handleSelect(doc)}
                  disabled={selectingId === doc.id}
                  className="px-5 py-2 rounded-lg bg-red-800 text-white text-sm font-medium hover:bg-red-900 transition disabled:opacity-40"
                >
                  {selectingId === doc.id ? 'Memproses...' : 'Selengkapnya'}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {paging && paging.total_page > 1 && (
        <div className="flex items-center justify-center gap-3 py-3 bg-white border-t border-slate-200">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="w-8 h-8 rounded-full border border-slate-200 text-slate-500 disabled:opacity-30 hover:bg-slate-50"
          >
            ‹
          </button>
          <span className="text-sm text-slate-500">
            {page} / {paging.total_page}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(paging.total_page, p + 1))}
            disabled={page >= paging.total_page}
            className="w-8 h-8 rounded-full border border-slate-200 text-slate-500 disabled:opacity-30 hover:bg-slate-50"
          >
            ›
          </button>
        </div>
      )}

      {paging && (
        <p className="text-center text-xs text-slate-400 pb-2">
          Menampilkan {results.length > 0 ? (page - 1) * paging.size + 1 : 0}-{Math.min(page * paging.size, paging.total_item)} dari {paging.total_item} item
        </p>
      )}
      </div>
    </div>
  )
}

export default JdihBrowser