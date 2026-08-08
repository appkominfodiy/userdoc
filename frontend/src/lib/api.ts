import type {
  DocumentListResponse,
  ChatResponse,
  PrepareResponse,
  JdihDocument,
} from "@/types/document";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

export async function fetchDocumentList(
  page: number,
  filters?: { search?: string; year?: string; category?: string }
): Promise<DocumentListResponse> {
  const params = new URLSearchParams({ page: String(page) });
  if (filters?.search) params.set("q", filters.search);
  if (filters?.year) params.set("tahun", filters.year);
  if (filters?.category) params.set("kategori", filters.category);

  const res = await fetch(`${API_URL}/documents?${params.toString()}`, { cache: "no-store" });
  if (!res.ok) throw new Error("Gagal mengambil daftar dokumen.");
  return res.json();
}

export async function fetchDocumentDetail(docId: string, slug: string): Promise<JdihDocument> {
  const res = await fetch(
    `${API_URL}/documents/${docId}/detail?slug=${encodeURIComponent(slug)}`,
    { cache: "no-store" }
  );
  if (!res.ok) throw new Error("Gagal mengambil detail dokumen.");
  return res.json();
}

export async function prepareDocument(docId: string, slug: string): Promise<PrepareResponse> {
  const res = await fetch(
    `${API_URL}/documents/${docId}/prepare?slug=${encodeURIComponent(slug)}`,
    { method: "POST" }
  );
  if (!res.ok) throw new Error("Gagal menyiapkan dokumen.");
  return res.json();
}

export function getPdfUrl(docId: string): string {
  return `${API_URL}/documents/${docId}/pdf`;
}

export async function sendChatMessage(docId: string, question: string): Promise<ChatResponse> {
  const res = await fetch(`${API_URL}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ doc_id: docId, question }),
  });
  if (!res.ok) throw new Error("Gagal mengirim pesan ke chatbot.");
  return res.json();
}

export async function resetChat(docId: string): Promise<void> {
  await fetch(`${API_URL}/chat/${docId}/reset`, { method: "POST" });
}

/** Pertanyaan STARTER — dibuat LLM dari cuplikan isi dokumen (bukan template statis). */
export async function fetchSuggestedQuestions(docId: string): Promise<string[]> {
  const res = await fetch(`${API_URL}/documents/${docId}/suggest-questions`);
  if (!res.ok) return [];
  const data = await res.json();
  return data.questions || [];
}

/** Pertanyaan FOLLOW-UP — dibuat LLM berdasarkan jawaban chat terakhir. */
export async function fetchFollowupQuestions(
  docId: string,
  question: string,
  answer: string
): Promise<string[]> {
  const res = await fetch(`${API_URL}/documents/${docId}/suggest-followup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question, answer }),
  });
  if (!res.ok) return [];
  const data = await res.json();
  return data.questions || [];
}