<?php

namespace App\Http\Controllers;

use App\Models\DokumenHukum;
use App\Services\RagflowService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Inertia\Inertia;

class DocumentController extends Controller
{
    /**
     * Halaman daftar semua dokumen — dari database Laravel (dokumen_hukums).
     */
    public function index()
    {
        $documents = DokumenHukum::orderByDesc('tanggal_penetapan')
            ->get(['id', 'jenis', 'nomor', 'tahun', 'judul', 'status', 'tanggal_penetapan', 'sync_status']);

        return Inertia::render('Documents/Index', [
            'documents' => $documents,
        ]);
    }

    /**
     * Halaman detail 1 dokumen — split view PDF + chatbot.
     */
    public function show(DokumenHukum $dokumenHukum)
    {
        return Inertia::render('Documents/Show', [
            'document' => $dokumenHukum,
        ]);
    }

    /**
     * Proxy PDF — Laravel yang mengambil PDF dari JDIH,
     * supaya browser tidak kena blokir CORS.
     */
    public function pdf(DokumenHukum $dokumenHukum)
    {
        // ⚠️ Mencoba beberapa nama kolom yang mungkin menyimpan URL PDF
        $url = $dokumenHukum->file_peraturan
            ?? $dokumenHukum->pdf_url
            ?? $dokumenHukum->file_url;

        if (! $url) {
            return response()->json([
                'error' => 'URL PDF tidak ditemukan di tabel dokumen_hukums. Cek nama kolomnya.',
            ], 422);
        }

        $resp = Http::timeout(60)->get($url);

        if (! $resp->successful()) {
            return response()->json([
                'error' => 'Gagal mengambil PDF dari JDIH (HTTP '.$resp->status().')',
            ], 502);
        }

        return response($resp->body(), 200, [
            'Content-Type' => 'application/pdf',
            'Cache-Control' => 'public, max-age=86400',
        ]);
    }

    /**
     * Endpoint chat — retrieval RAGFlow di-scope ke dokumen ini.
     */
    public function chat(Request $request, DokumenHukum $dokumenHukum, RagflowService $ragflow)
    {
        $request->validate([
            'question' => 'required|string|max:1000',
        ]);

        if (! $dokumenHukum->ragflow_document_id) {
            return response()->json([
                'answer' => 'Dokumen ini belum selesai diproses di RAGFlow, coba lagi nanti.',
            ], 422);
        }

        $answer = $ragflow->askDocument(
            $dokumenHukum->ragflow_document_id,
            $request->input('question')
        );

        return response()->json(['answer' => $answer]);
    }
}