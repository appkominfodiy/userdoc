<?php

namespace App\Http\Controllers;

use App\Models\DokumenHukum;
use App\Services\RagflowService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Inertia\Inertia;

class DocumentController extends Controller
{
    public function index()
    {
        $documents = DokumenHukum::orderByDesc('tanggal_penetapan')
            ->get(['id', 'jenis', 'nomor', 'tahun', 'judul', 'status', 'tanggal_penetapan', 'sync_status']);

        return Inertia::render('Documents/Index', [
            'documents' => $documents,
        ]);
    }

    public function show(DokumenHukum $dokumenHukum)
    {
        return Inertia::render('Documents/Show', [
            'document' => $dokumenHukum,
            'assistant' => [
                'name'         => config('jdih_prompts.assistant_profile.name'),
                'tagline'      => config('jdih_prompts.assistant_profile.tagline'),
                'greeting'     => config('jdih_prompts.assistant_profile.greeting'),
                'description'  => config('jdih_prompts.assistant_profile.description'),
                'capabilities' => config('jdih_prompts.assistant_profile.capabilities'),
                'suggested'    => config('jdih_prompts.assistant_profile.suggested_questions'),
            ],
        ]);
    }

    public function pdf(DokumenHukum $dokumenHukum)
    {
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

    public function chat(Request $request, DokumenHukum $dokumenHukum, RagflowService $ragflow)
    {
        // Kasih waktu sampai 2 menit untuk generate follow-up
        set_time_limit(120);

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

        // Generate 2 pertanyaan lanjutan dari topik jawaban
        $suggestions = [];
        try {
            $prompt = str_replace(
                ['{question}', '{answer}'],
                [$request->input('question'), Str::limit($answer, 1500)],
                config('jdih_prompts.suggestion_prompts.followup')
            );
            $suggestions = $this->parseJsonArray($this->ollamaGenerate($prompt));
        } catch (\Throwable $e) {
            $suggestions = [];
        }

        return response()->json([
            'answer'      => $answer,
            'suggestions' => $suggestions,
        ]);
    }

    public function suggestions(DokumenHukum $dokumenHukum)
    {
        // Kasih waktu sampai 2 menit untuk cold-start Ollama
        set_time_limit(120);

        $suggestions = Cache::remember(
            'doc_suggestions_'.$dokumenHukum->id,
            60 * 60 * 24,
            function () use ($dokumenHukum) {
                $prompt = str_replace(
                    ['{judul}', '{jenis}', '{nomor_tahun}'],
                    [$dokumenHukum->judul, $dokumenHukum->jenis, $dokumenHukum->nomor.' Tahun '.$dokumenHukum->tahun],
                    config('jdih_prompts.suggestion_prompts.welcome')
                );

                return $this->parseJsonArray($this->ollamaGenerate($prompt));
            }
        );

        return response()->json(['suggestions' => $suggestions]);
    }

    private function ollamaGenerate(string $prompt): string
    {
        $resp = Http::timeout(90)
            ->connectTimeout(10)
            ->post(
                config('jdih_prompts.ollama.base_url').'/api/generate',
                [
                    'model'  => config('jdih_prompts.ollama.model'),
                    'prompt' => $prompt,
                    'stream' => false,
                    'options' => [
                        'num_predict' => 300,  // batasi output biar cepat
                        'temperature' => 0.3,
                    ],
                ]
            );

        return $resp->successful() ? ($resp->json('response') ?? '') : '';
    }

    private function parseJsonArray(string $raw): array
    {
        if (preg_match('/\[[^\]]*\]/s', $raw, $m)) {
            $arr = json_decode($m[0], true);
            if (is_array($arr)) {
                return array_values(array_filter($arr, 'is_string'));
            }
        }

        return [];
    }
}