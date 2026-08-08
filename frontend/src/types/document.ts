export interface JdihDocument {
  id: number;
  doc_id: string;
  slug: string;
  judul_peraturan: string;
  nomor?: string;
  tahun_terbit?: string;
  tanggal_pengundangan?: string;
  kategori_hukum_name?: string;
  file_peraturan?: string;
  view_count?: number;
  download_count?: number;
  status_produk_hukum?: string;
}

export interface DocumentListResponse {
  documents: JdihDocument[];
  page: number;
  has_next: boolean;
  total_page: number;
  total_item?: number;
}

export interface ChatMessage {
  role: "user" | "assistant";
  text: string;
  sources?: Source[];
}

export interface Source {
  page: string;
  score: number;
}

export interface ChatResponse {
  answer: string;
  sources: Source[];
}

export interface PrepareResponse {
  doc_id: string;
  ready: boolean;
  total_pages: number;
}