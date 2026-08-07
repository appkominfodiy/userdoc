import { useState, useEffect, useCallback } from 'react'
import { api } from '../api'

const KATEGORI_OPTIONS = [
  { value: '', label: 'Semua kategori' },
  { value: 1, label: 'Peraturan Daerah' },
  { value: 2, label: 'Peraturan Gubernur' },
  { value: 3, label: 'Keputusan Gubernur' },
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
      <form onSubmit={handleSearchSubmit} className="p-4 bg-white border-b border-slate-200 space-y-3">
        <div className="relative">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Ketik kata kunci pencarian"
            className="w-full border border-slate-300 rounded-lg pl-4 pr-10 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
          />
          <button
            type="submit"
            className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-red-700"
          >
            🔍
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <select
            value={tahun}
            onChange={(e) => { setTahun(e.target.value); setPage(1) }}
            className="border border-slate-300 rounded-lg px-2 py-2 text-sm"
          >
            <option value="">Semua tahun</option>
            {Array.from({ length: 10 }, (_, i) => 2026 - i).map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>

          <select
            value={kategori}
            onChange={(e) => { setKategori(e.target.value); setPage(1) }}
            className="border border-slate-300 rounded-lg px-2 py-2 text-sm"
          >
            {KATEGORI_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>

          <select
            value={status}
            onChange={(e) => { setStatus(e.target.value); setPage(1) }}
            className="border border-slate-300 rounded-lg px-2 py-2 text-sm"
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>

          <select
            value={order}
            onChange={(e) => { setOrder(e.target.value); setPage(1) }}
            className="border border-slate-300 rounded-lg px-2 py-2 text-sm"
          >
            {ORDER_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      </form>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
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
          <div key={doc.id} className="bg-white rounded-xl border border-slate-200 p-4 space-y-2">
            <h3 className="font-medium text-slate-800 text-sm leading-snug">
              {doc.judul_peraturan}
            </h3>
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
              <span>{doc.kategori_hukum_name}</span>
              <span>·</span>
              <span>{doc.tanggal_pengundangan}</span>
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
            <button
              onClick={() => handleSelect(doc)}
              disabled={selectingId === doc.id}
              className="text-sm px-4 py-1.5 rounded-full bg-red-800 text-white hover:bg-red-900 transition disabled:opacity-40"
            >
              {selectingId === doc.id ? 'Memproses...' : 'Selengkapnya'}
            </button>
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
    </div>
  )
}

export default JdihBrowser