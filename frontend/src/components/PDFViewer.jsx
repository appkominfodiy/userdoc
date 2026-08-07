import { useState, useRef, useEffect, useCallback } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'
import { API_BASE } from '../api'

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString()

const MIN_ZOOM = 0.5
const MAX_ZOOM = 1
const ZOOM_STEP = 0.2

function PDFViewer({ documentId, currentPage, onPageChange }) {
  const [numPages, setNumPages] = useState(null)
  const [error, setError] = useState(null)
  const [containerWidth, setContainerWidth] = useState(600)
  const [zoom, setZoom] = useState(1)
  const scrollRef = useRef(null)

  useEffect(() => {
    if (!scrollRef.current) return
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width
      if (width) setContainerWidth(width)
    })
    observer.observe(scrollRef.current)
    return () => observer.disconnect()
  }, [])

  function onDocumentLoadSuccess({ numPages }) {
    setNumPages(numPages)
    setError(null)
  }

  function onDocumentLoadError(err) {
    setError('Gagal memuat PDF.')
    console.error(err)
  }

  const handleZoomIn = useCallback(() => {
    setZoom((z) => Math.min(MAX_ZOOM, +(z + ZOOM_STEP).toFixed(2)))
  }, [])

  const handleZoomOut = useCallback(() => {
    setZoom((z) => Math.max(MIN_ZOOM, +(z - ZOOM_STEP).toFixed(2)))
  }, [])

  const handleZoomReset = useCallback(() => {
    setZoom(1)
  }, [])

  const targetWidth = Math.max(200, containerWidth - 32) * zoom

  return (
    <div className="h-full min-h-0 flex flex-col bg-slate-50">
      {error && <p className="text-red-500 p-4 text-sm flex-shrink-0">{error}</p>}

      <div
        ref={scrollRef}
        className="flex-1 min-h-0 overflow-auto"
        style={{ touchAction: 'pan-x pan-y' }}
      >
        <div className="min-w-fit flex justify-center p-4">
          <div className="shadow-lg rounded-lg overflow-hidden bg-white h-fit">
            <Document
              file={`${API_BASE}/pdf/${documentId}`}
              onLoadSuccess={onDocumentLoadSuccess}
              onLoadError={onDocumentLoadError}
              loading={<p className="p-8 text-slate-400 text-sm">Memuat PDF...</p>}
            >
              <Page pageNumber={currentPage} width={targetWidth} />
            </Document>
          </div>
        </div>
      </div>

      {numPages && (
        <div className="flex-shrink-0 flex items-center justify-center gap-3 py-3 bg-white border-t border-slate-200">
          <button
            onClick={() => onPageChange(Math.max(1, currentPage - 1))}
            disabled={currentPage <= 1}
            className="w-8 h-8 rounded-full border border-slate-200 text-slate-500 disabled:opacity-30 hover:bg-slate-50 transition"
          >
            ‹
          </button>
          <span className="text-sm text-slate-500 whitespace-nowrap">
            {currentPage} / {numPages}
          </span>
          <button
            onClick={() => onPageChange(Math.min(numPages, currentPage + 1))}
            disabled={currentPage >= numPages}
            className="w-8 h-8 rounded-full border border-slate-200 text-slate-500 disabled:opacity-30 hover:bg-slate-50 transition"
          >
            ›
          </button>

          <div className="w-px h-5 bg-slate-200 mx-1" />

          <button
            onClick={handleZoomOut}
            disabled={zoom <= MIN_ZOOM}
            className="w-8 h-8 rounded-full border border-slate-200 text-slate-500 disabled:opacity-30 hover:bg-slate-50 transition"
          >
            −
          </button>
          <button
            onClick={handleZoomReset}
            className="text-xs text-slate-500 px-2 py-1 rounded hover:bg-slate-50 transition min-w-[3rem]"
          >
            {Math.round(zoom * 100)}%
          </button>
          <button
            onClick={handleZoomIn}
            disabled={zoom >= MAX_ZOOM}
            className="w-8 h-8 rounded-full border border-slate-200 text-slate-500 disabled:opacity-30 hover:bg-slate-50 transition"
          >
            +
          </button>
        </div>
      )}
    </div>
  )
}

export default PDFViewer