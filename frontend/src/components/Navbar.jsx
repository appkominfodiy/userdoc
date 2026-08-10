function Navbar({ hasDocument, onBackToBrowse, sidebarOpen, onToggleSidebar }) {
  return (
    <nav className="sticky top-0 z-30 bg-gradient-to-r from-red-900 to-red-800 shadow-md">
      <div className="px-3 sm:px-5 py-2.5 sm:py-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <img
            src="/logo.svg"
            alt="Logo"
            className="w-8 h-8 flex-shrink-0 rounded-lg object-contain bg-white/10 p-1"
          />
          <div className="min-w-0">
            <h1 className="font-semibold text-white text-sm leading-tight truncate">
              Chatbot Perda DIY
            </h1>
            <p className="hidden sm:block text-xs text-red-200 leading-tight">
              JDIH DPRD DIY
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {hasDocument && (
            <>
              <button
                onClick={onToggleSidebar}
                className="text-xs sm:text-sm px-2.5 sm:px-3 py-1.5 rounded-full border border-white/30 text-white hover:bg-white/10 transition whitespace-nowrap"
              >
                {sidebarOpen ? 'Tutup' : 'Chat'}
              </button>
              <button
                onClick={onBackToBrowse}
                className="text-xs sm:text-sm px-3 sm:px-4 py-1.5 rounded-full bg-white text-red-800 font-medium hover:bg-red-50 transition whitespace-nowrap"
              >
                Cari Dokumen Lain
              </button>
            </>
          )}
        </div>
      </div>
    </nav>
  )
}

export default Navbar