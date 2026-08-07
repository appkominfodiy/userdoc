import { useState, useEffect, useRef, useCallback } from 'react'
import Navbar from '../components/Navbar'
import Chatbot from '../components/Chatbot'
import PDFViewer from '../components/PDFViewer'
import JdihBrowser from '../components/JdihBrowser'
import { api } from '../api'

const STORAGE_KEY = 'chatbot_perda_document_id'
const WIDTH_STORAGE_KEY = 'chatbot_perda_sidebar_width'
const MIN_WIDTH = 280
const MAX_WIDTH = 640
const DEFAULT_WIDTH = 384
const MOBILE_BREAKPOINT = 768

function Home() {
  const [documentId, setDocumentId] = useState(null)
  const [page, setPage] = useState(1)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem(WIDTH_STORAGE_KEY)
    return saved ? Number(saved) : DEFAULT_WIDTH
  })
  const [isMobile, setIsMobile] = useState(
    () => window.innerWidth < MOBILE_BREAKPOINT
  )
  const isResizing = useRef(false)

  const [checkingStorage, setCheckingStorage] = useState(
    () => !!localStorage.getItem(STORAGE_KEY)
  )

  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
    function handleChange(e) {
      setIsMobile(e.matches)
    }
    mql.addEventListener('change', handleChange)
    return () => mql.removeEventListener('change', handleChange)
  }, [])

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (!saved) return

    api.get(`/pdf/${saved}`)
      .then(() => {
        setDocumentId(saved)
        setSidebarOpen(true)
      })
      .catch(() => {
        localStorage.removeItem(STORAGE_KEY)
      })
      .finally(() => setCheckingStorage(false))
  }, [])

  function chatStorageKey(documentId) {
  return `chatbot_perda_messages_${documentId}`
}

function handleDocumentSelected(newDocumentId) {
  localStorage.removeItem(chatStorageKey(newDocumentId))

  setDocumentId(newDocumentId)
  setPage(1)
  setSidebarOpen(true)
  localStorage.setItem(STORAGE_KEY, newDocumentId)
}

  function handleBackToBrowse() {
    setDocumentId(null)
    setSidebarOpen(false)
    localStorage.removeItem(STORAGE_KEY)
  }

  const handleResizeStart = useCallback((e) => {
    if (isMobile) return
    e.preventDefault()
    isResizing.current = true
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }, [isMobile])

  useEffect(() => {
    function handleMouseMove(e) {
      if (!isResizing.current) return
      const newWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, e.clientX))
      setSidebarWidth(newWidth)
    }

    function handleMouseUp() {
      if (!isResizing.current) return
      isResizing.current = false
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      localStorage.setItem(WIDTH_STORAGE_KEY, String(sidebarWidth))
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [sidebarWidth])

  if (checkingStorage) {
    return (
      <div className="h-dvh flex items-center justify-center bg-amber-50">
        <p className="text-slate-400 text-sm">Memuat...</p>
      </div>
    )
  }

  return (
    <div className="h-dvh flex flex-col bg-amber-50">
      <Navbar
        hasDocument={!!documentId}
        onBackToBrowse={handleBackToBrowse}
        sidebarOpen={sidebarOpen}
        onToggleSidebar={() => setSidebarOpen((v) => !v)}
      />

      {!documentId ? (
        <div className="flex-1 min-h-0">
          <JdihBrowser onSelectDocument={handleDocumentSelected} />
        </div>
      ) : (
        <div className="flex flex-1 overflow-hidden">
          {sidebarOpen && (
            <>
              <div
                style={isMobile ? undefined : { width: sidebarWidth }}
                className={
                  isMobile
                    ? 'absolute inset-0 z-20 bg-white'
                    : 'flex-shrink-0 overflow-hidden border-r border-slate-200'
                }
              >
                <Chatbot key={documentId} documentId={documentId} onJumpToPage={setPage} />
              </div>

              {!isMobile && (
                <div
                  onMouseDown={handleResizeStart}
                  className="w-1 flex-shrink-0 cursor-col-resize bg-transparent hover:bg-red-300 active:bg-red-400 transition-colors"
                  title="Geser untuk mengubah ukuran"
                />
              )}
            </>
          )}
          <div className="flex-1">
            <PDFViewer key={documentId} documentId={documentId} currentPage={page} onPageChange={setPage} />
          </div>
        </div>
      )}
    </div>
  )
}

export default Home