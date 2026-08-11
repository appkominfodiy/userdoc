const API_BASE = 'http://127.0.0.1:8000';
const API_ENDPOINTS = {
    peraturan: 'https://spl.jogjaprov.go.id/jdih-etalase/public/produk-hukum/',
    monografi: 'https://spl.jogjaprov.go.id/jdih-etalase/public/monografi-hukum/',
    artikel: 'https://spl.jogjaprov.go.id/jdih-etalase/public/artikel-hukum/',
    putusan: 'https://spl.jogjaprov.go.id/jdih-etalase/public/putusan-pengadilan/'
};

let currentCategory = document.body.getAttribute('data-category') || 'peraturan';
let currentPage = 1;
const itemsPerPage = 10;

// DOM Elements
const chatForm = document.getElementById('chatForm');
const userInput = document.getElementById('userInput');
const chatMessages = document.getElementById('chatMessages');
const sendBtn = document.getElementById('sendBtn');
const toast = document.getElementById('toast');
const documentsGrid = document.getElementById('documentsGrid');

const chatToggleBtn = document.getElementById('chatToggleBtn');
const chatWindow = document.getElementById('chatWindow');
const closeChatBtn = document.getElementById('closeChatBtn');

// Modal Elements
const pdfModal = document.getElementById('pdfModal');
const closePdfModalBtn = document.getElementById('closePdfModalBtn');
const pdfIframe = document.getElementById('pdfIframe');
const modalDocTitle = document.getElementById('modalDocTitle');
const modalChatForm = document.getElementById('modalChatForm');
const modalUserInput = document.getElementById('modalUserInput');
const modalChatMessages = document.getElementById('modalChatMessages');
const modalSendBtn = document.getElementById('modalSendBtn');
let currentPdfContext = '';
let currentPdfUrl = '';

// --- Floating Chatbot Logic ---

chatToggleBtn.addEventListener('click', () => {
    chatWindow.classList.toggle('open');
    if (chatWindow.classList.contains('open')) {
        userInput.focus();
    }
});

closeChatBtn.addEventListener('click', () => {
    chatWindow.classList.remove('open');
});

// --- Helper Functions ---

function showToast(message, isError = false) {
    toast.textContent = message;
    toast.className = `toast ${isError ? 'error' : ''} show`;
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

function scrollToBottom() {
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function formatTextToHTML(text) {
    let html = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br>');
    return `<p>${html}</p>`;
}

function openPdfNewTab(filename) {
    const encodedFilename = encodeURIComponent(filename);
    const pdfUrl = `${API_BASE}/static/${encodedFilename}`;
    window.open(pdfUrl, '_blank');
}

function showTypingIndicator(container) {
    const msgDiv = document.createElement('div');
    msgDiv.className = 'message system typing-msg';
    msgDiv.innerHTML = `
        <div class="message-content" style="background: transparent; padding: 0; display: inline-block; border: none;">
            <div class="claude-thinking">
                <div class="claude-star"></div>
                <span class="claude-text">Menganalisis...</span>
            </div>
        </div>
    `;
    container.appendChild(msgDiv);
    container.scrollTop = container.scrollHeight;
    return msgDiv;
}

function removeTypingIndicator(msgDiv) {
    if (msgDiv && msgDiv.parentNode) {
        msgDiv.parentNode.removeChild(msgDiv);
    }
}

function addSuggestionChips(container, suggestions, inputElement, formElement) {
    const chipsDiv = document.createElement('div');
    chipsDiv.className = 'suggestion-chips';
    
    suggestions.forEach(text => {
        const chip = document.createElement('div');
        chip.className = 'suggestion-chip';
        chip.textContent = text;
        chip.onclick = () => {
            inputElement.value = text;
            if (formElement) formElement.dispatchEvent(new Event('submit'));
        };
        chipsDiv.appendChild(chip);
    });
    
    const wrapper = document.createElement('div');
    wrapper.style.display = 'flex';
    wrapper.style.justifyContent = 'flex-start';
    wrapper.appendChild(chipsDiv);
    
    container.appendChild(wrapper);
    container.scrollTop = container.scrollHeight;
}

// Category management is now handled by individual HTML files.

// --- Fetch & Render JDIH Products ---

function formatDate(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    if (isNaN(date)) return dateString;
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
    return `${date.getDate().toString().padStart(2, '0')} ${months[date.getMonth()]} ${date.getFullYear()}`;
}

async function fetchAndRenderJDIHDocuments() {
    documentsGrid.innerHTML = '<div class="loading-state"><i class="fas fa-spinner fa-spin"></i> Memuat data dari server JDIH...</div>';
    document.getElementById('paginationContainer').innerHTML = ''; // Clear pagination while loading
    try {
        let apiUrl = `${API_ENDPOINTS[currentCategory]}?page=${currentPage}&size=${itemsPerPage}&order=-tanggal_pengundangan`;
        
        const searchInput = document.getElementById('searchInput');
        if (searchInput && searchInput.value.trim()) {
            apiUrl += `&keyword=${encodeURIComponent(searchInput.value.trim())}`;
        }
        
        const yearInput = document.getElementById('yearInput');
        if (yearInput && yearInput.value.trim()) {
            apiUrl += `&tahun=${encodeURIComponent(yearInput.value.trim())}`;
        }

        const response = await fetch(apiUrl, {
            headers: {
                'Accept': 'application/json, text/plain, */*'
            }
        });
        
        if (!response.ok) throw new Error('Gagal memuat data');
        
        const data = await response.json();
        const items = data.data || (data.data?.items) || [];
        const paging = data.paging || {};
        const totalItems = paging.total_item || items.length;
        const totalPages = paging.total_page || Math.ceil(totalItems / itemsPerPage);
        
        if (items.length === 0) {
            documentsGrid.innerHTML = '<div class="loading-state">Tidak ada dokumen ditemukan.</div>';
            return;
        }

        documentsGrid.innerHTML = '';
        
        items.forEach(item => {
            const card = document.createElement('div');
            card.className = 'doc-card';
            
            const titleFull = item.judul_peraturan || item.title || item.judul || item.nama || 'Dokumen Hukum';
            const year = item.tahun_terbit || item.tahun_pengundangan || (item.published_at ? new Date(item.published_at).getFullYear() : '-');
            const number = item.nomor || item.isbn_issn || '-';
            const type = item.kategori_hukum_name || item.category_name || item.jenis_produk_hukum?.nama || currentCategory.toUpperCase();
            
            let statusLabel = 'Berlaku';
            if (item.status_produk_hukum === '2') statusLabel = 'Tidak Berlaku';
            if (currentCategory !== 'peraturan') statusLabel = 'Publish'; // For non-peraturan

            const dateFormatted = formatDate(item.tanggal_pengundangan || item.published_at || item.created_at);
            const slug = item.slug;
            const views = item.view_count || 0;
            const downloads = item.download_count || 0;

            const shortTitle = (currentCategory === 'peraturan' || currentCategory === 'putusan') 
                ? `${number !== '-' ? number + ' ' : ''}Tahun ${year} | ${dateFormatted}` 
                : `${type} | ${year}`;

            card.innerHTML = `
                <div class="doc-header-row">
                    <div class="doc-icon-container">
                        <i class="${currentCategory === 'monografi' ? 'fas fa-book-open' : (currentCategory === 'putusan' ? 'fas fa-gavel' : 'far fa-file-alt')}"></i>
                    </div>
                    <div class="doc-info">
                        <div class="doc-title-main">${shortTitle}</div>
                        <div class="doc-type-row">
                            <span class="doc-type-text">${type}</span>
                            <span class="status-badge">${statusLabel}</span>
                        </div>
                    </div>
                </div>
                <div class="doc-desc">
                    ${titleFull}
                </div>
                <div class="doc-footer">
                    <div class="doc-stats">
                        <span><i class="far fa-eye"></i> ${views} dilihat</span>
                        <span><i class="fas fa-download"></i> ${downloads} diunduh</span>
                    </div>
                    <div class="doc-actions">
                        <button class="btn btn-download" onclick="downloadPdf('${slug}')">
                            Download <i class="fas fa-download text-xs"></i>
                        </button>
                        <button class="btn btn-detail" onclick="viewPdfDetail('${slug}')">
                            Selengkapnya <i class="fas fa-chevron-right text-xs"></i>
                        </button>
                    </div>
                </div>
            `;
            
            documentsGrid.appendChild(card);
        });
        
        renderPagination(totalPages, totalItems);
        
    } catch (error) {
        documentsGrid.innerHTML = `<div class="loading-state">Gagal memuat data dari server JDIH: ${error.message}</div>`;
    }
}

function renderPagination(totalPages, totalItems) {
    const paginationContainer = document.getElementById('paginationContainer');
    if (!paginationContainer || totalPages <= 1) return;

    let html = '<div class="pagination-buttons">';
    
    // Prev Button
    html += `<button class="page-btn ${currentPage === 1 ? 'disabled' : ''}" onclick="goToPage(${currentPage - 1})" ${currentPage === 1 ? 'disabled' : ''}><i class="fas fa-chevron-left"></i></button>`;

    // Page Numbers logic (1, 2, 3, ..., 16, 17, 18)
    const maxVisible = 3;
    
    // Left numbers
    for (let i = 1; i <= totalPages; i++) {
        if (
            i === 1 || 
            i === totalPages || 
            (i >= currentPage - 1 && i <= currentPage + 1)
        ) {
            html += `<button class="page-btn ${currentPage === i ? 'active' : ''}" onclick="goToPage(${i})">${i}</button>`;
        } else if (
            i === currentPage - 2 || 
            i === currentPage + 2
        ) {
            html += `<span class="page-dots">...</span>`;
        }
    }
    
    // Next Button
    html += `<button class="page-btn ${currentPage === totalPages ? 'disabled' : ''}" onclick="goToPage(${currentPage + 1})" ${currentPage === totalPages ? 'disabled' : ''}><i class="fas fa-chevron-right"></i></button>`;
    html += '</div>';

    // Text "Menampilkan 1-10 dari 180 item"
    const startItem = (currentPage - 1) * itemsPerPage + 1;
    const endItem = Math.min(currentPage * itemsPerPage, totalItems);
    html += `<div class="pagination-info">Menampilkan ${startItem}-${endItem} dari ${totalItems} item</div>`;

    paginationContainer.innerHTML = html;
    
    // Cleanup multiple dots that might appear
    let tempDiv = document.createElement('div');
    tempDiv.innerHTML = paginationContainer.innerHTML;
    let dots = tempDiv.querySelectorAll('.page-dots');
    for(let i=1; i<dots.length; i++) {
        if(dots[i].previousElementSibling === dots[i-1]) {
            dots[i].remove();
        }
    }
    paginationContainer.innerHTML = tempDiv.innerHTML;
}

window.goToPage = function(page) {
    if (page < 1) return;
    currentPage = page;
    fetchAndRenderJDIHDocuments();
    document.getElementById('documentsGrid').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

window.resetSearch = function() {
    const searchInput = document.getElementById('searchInput');
    const yearInput = document.getElementById('yearInput');
    if (searchInput) searchInput.value = '';
    if (yearInput) yearInput.value = '';
    currentPage = 1;
    fetchAndRenderJDIHDocuments();
}

window.downloadPdf = async function(slug) {
    showToast("Mengunduh dokumen PDF...");
    try {
        const res = await fetch(`${API_ENDPOINTS[currentCategory]}${slug}`);
        const data = await res.json();
        const itemData = data.data;
        const fileUrl = itemData?.file_peraturan || itemData?.lampiran || itemData?.cover;
        if (fileUrl) {
            window.open(fileUrl, '_blank');
        } else {
            showToast("File PDF tidak tersedia untuk dokumen ini.", true);
        }
    } catch(e) {
        showToast("Gagal mengambil file PDF.", true);
    }
}

window.viewPdfDetail = async function(slug) {
    showToast("Mengambil dokumen PDF...");
    try {
        const res = await fetch(`${API_ENDPOINTS[currentCategory]}${slug}`);
        const data = await res.json();
        const itemData = data.data;
        const fileUrl = itemData?.file_peraturan || itemData?.lampiran || itemData?.cover;
        const title = itemData?.judul_peraturan || itemData?.title || itemData?.judul || 'Dokumen';
        
        if (fileUrl) {
            modalDocTitle.textContent = title;
            currentPdfContext = title;
            currentPdfUrl = fileUrl;
            pdfIframe.src = fileUrl;
            pdfModal.classList.remove('hidden');
            // Clear messages
            modalChatMessages.innerHTML = '';
            modalUserInput.disabled = false;
            modalSendBtn.disabled = false;
            
            modalChatMessages.innerHTML = `
                <div class="message system">
                    <div class="message-content" style="background: white; padding: 0.75rem 1rem; border-radius: 12px; border: 1px solid var(--border); border-bottom-left-radius: 4px; display: inline-block;">
                        Halo! Saya siap membantu Anda memahami dokumen <strong>${title}</strong>. Apa yang ingin Anda tanyakan?
                    </div>
                </div>
            `;
            addSuggestionChips(modalChatMessages, [
                "Apa ringkasan dokumen ini?",
                "Kapan dokumen ini ditetapkan?",
                "Apa poin penting dari peraturan ini?"
            ], modalUserInput, modalChatForm);
        } else {
            showToast("File PDF tidak tersedia untuk dokumen ini.", true);
        }
    } catch(e) {
        showToast("Gagal mengambil file PDF.", true);
    }
}

closePdfModalBtn.addEventListener('click', () => {
    pdfModal.classList.add('hidden');
    pdfIframe.src = '';
    currentPdfUrl = '';
});

// Modal Chat Logic
function addModalMessage(content, isUser = false) {
    const msgDiv = document.createElement('div');
    msgDiv.className = `message ${isUser ? 'user' : 'system'}`;
    
    let innerStyles = isUser 
        ? 'background: var(--primary); color: white; border-bottom-right-radius: 4px;' 
        : 'background: white; color: var(--text-main); border: 1px solid var(--border); border-bottom-left-radius: 4px;';
        
    let innerHTML = `<div class="message-content" style="padding: 0.75rem 1rem; border-radius: 12px; display: inline-block; ${innerStyles}">${isUser ? content : formatTextToHTML(content)}</div>`;
    
    msgDiv.innerHTML = innerHTML;
    modalChatMessages.appendChild(msgDiv);
    modalChatMessages.scrollTop = modalChatMessages.scrollHeight;
}

modalChatForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const query = modalUserInput.value.trim();
    if (!query) return;

    addModalMessage(query, true);
    modalUserInput.value = '';
    modalSendBtn.disabled = true;
    
    const typingIndicator = showTypingIndicator(modalChatMessages);
    
    try {
        // Hapus 'Dalam konteks dokumen' jika ada pdf_url, 
        // karena backend on-the-fly sudah memproses dokumen tsb.
        const response = await fetch(`${API_BASE}/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                query: query, 
                top_k: 5,
                pdf_url: currentPdfUrl
            })
        });

        const data = await response.json();
        removeTypingIndicator(typingIndicator);
        modalSendBtn.disabled = false;

        if (data.status === 'success') {
            addModalMessage(data.answer, false);
            addSuggestionChips(modalChatMessages, [
                "Bisa jelaskan lebih detail?",
                "Sebutkan pasal yang terkait",
                "Apa kesimpulannya?"
            ], modalUserInput, modalChatForm);
        } else {
            addModalMessage("Maaf, terjadi kesalahan saat memproses pertanyaan Anda.", false);
        }
    } catch (error) {
        removeTypingIndicator(typingIndicator);
        modalSendBtn.disabled = false;
        addModalMessage("Gagal terhubung ke server.", false);
    }
});

// Load documents on page load
document.addEventListener('DOMContentLoaded', fetchAndRenderJDIHDocuments);


// --- Chat Logic ---

function addMessage(content, isUser = false, sources = []) {
    const msgDiv = document.createElement('div');
    msgDiv.className = `message ${isUser ? 'user' : 'system'}`;
    
    let innerHTML = `<div class="message-content">${isUser ? content : formatTextToHTML(content)}</div>`;
    
    if (!isUser && sources && sources.length > 0) {
        let chipsHtml = '<div class="source-chips">';
        sources.forEach(source => {
            const match = source.match(/(.+?)\s*\(Hal\.\s*(\d+)\)/);
            let chipData = `onclick="alert('Detail sumber: ${source}')"`;
            if (match) {
                const filename = match[1];
                chipData = `onclick="openPdfNewTab('${filename}')"`;
            }
            chipsHtml += `<div class="source-chip" ${chipData}>📄 ${source}</div>`;
        });
        chipsHtml += '</div>';
        innerHTML += chipsHtml;
    }
    
    msgDiv.innerHTML = innerHTML;
    chatMessages.appendChild(msgDiv);
    scrollToBottom();
}

chatForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const query = userInput.value.trim();
    if (!query) return;

    addMessage(query, true);
    userInput.value = '';
    sendBtn.disabled = true;
    
    const typingIndicator = showTypingIndicator(chatMessages);
    
    try {
        const response = await fetch(`${API_BASE}/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: query, top_k: 3 })
        });

        const data = await response.json();
        removeTypingIndicator(typingIndicator);
        sendBtn.disabled = false;

        if (data.status === 'success') {
            addMessage(data.answer, false, data.sources);
        } else {
            addMessage("Maaf, terjadi kesalahan saat memproses pertanyaan Anda.", false);
            showToast(data.message, true);
        }
    } catch (error) {
        removeTypingIndicator(typingIndicator);
        sendBtn.disabled = false;
        addMessage("Gagal terhubung ke server. Pastikan backend sudah berjalan.", false);
        showToast("Koneksi gagal", true);
    }
});
