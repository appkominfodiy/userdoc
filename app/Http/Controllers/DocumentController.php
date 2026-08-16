<?php

namespace App\Http\Controllers;

use App\Models\DokumenHukum;
use App\Services\RagflowService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
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
            abort(404, 'URL PDF tidak ditemukan di database.');
        }

        try {
            // Coba download via proxy Laravel (timeout 60 detik)
            $resp = Http::timeout(60)->connectTimeout(10)->get($url);

            // Kalau sukses dan benar-benar PDF, kembalikan ke browser
            if ($resp->successful() && str_contains($resp->header('Content-Type') ?? '', 'pdf')) {
                return response($resp->body(), 200, [
                    'Content-Type'  => 'application/pdf',
                    'Cache-Control' => 'public, max-age=86400',
                ]);
            }
        } catch (\Exception $e) {
            // Kalau timeout atau error, biarkan lanjut ke fallback di bawah
            Log::warning('Proxy PDF gagal untuk dokumen '.$dokumenHukum->id.': '.$e->getMessage());
        }

        // FALLBACK: Kalau proxy gagal/timeout, redirect langsung ke URL asli JDIH
        // Browser user yang akan langsung fetch ke server JDIH (lebih stabil)
        return redirect()->away($url);
    }

    public function chat(Request $request, DokumenHukum $dokumenHukum, RagflowService $ragflow)
    {
        set_time_limit(300);

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

        $suggestions = [];
        try {
            $prompt = str_replace(
                ['{question}', '{answer}'],
                [$request->input('question'), Str::limit($answer, 800)],
                config('jdih_prompts.suggestion_prompts.followup')
            );
            $suggestions = $this->parseJsonArray($this->ollamaGenerate($prompt));
        } catch (\Throwable $e) {
            Log::warning('Follow-up generation failed: '.$e->getMessage());
            $suggestions = [];
        }

        return response()->json([
            'answer'      => $answer,
            'suggestions' => $suggestions,
        ]);
    }

    public function suggestions(DokumenHukum $dokumenHukum)
    {
        set_time_limit(300);

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

    /** Generate teks singkat pakai model CEPAT (1.5b). */
    private function ollamaGenerate(string $prompt): string
    {
        $resp = Http::timeout(120)
            ->connectTimeout(10)
            ->post(
                config('jdih_prompts.ollama.base_url').'/api/generate',
                [
                    'model'  => config('jdih_prompts.ollama.fast_model'),
                    'prompt' => $prompt,
                    'stream' => false,
                    'options' => [
                        'num_predict' => 200,
                        'temperature' => 0.5,
                    ],
                ]
            );

        $body = $resp->successful() ? ($resp->json('response') ?? '') : '';

        Log::info('Ollama generate response: '.$body);

        return $body;
    }

    /** Ambil array JSON dari respons LLM — tahan terhadap output terpotong. */
    private function parseJsonArray(string $raw): array
    {
        // 1) Coba JSON array utuh
        if (preg_match('/\[[^\]]*\]/s', $raw, $m)) {
            $arr = json_decode($m[0], true);
            if (is_array($arr)) {
                $clean = array_values(array_filter($arr, 'is_string'));
                if (count($clean) > 0) {
                    return $clean;
                }
            }
        }

        // 2) Fallback: JSON terpotong → ambil semua string berakhiran "?"
        preg_match_all('/"([^"\n]{5,100}\?)/u', $raw, $m2);
        if (! empty($m2[1])) {
            return array_slice($m2[1], 0, 3);
        }

        // 3) Fallback: baris polos berakhiran "?"
        preg_match_all('/^[\s\-\d\.]*([^\n"]{5,100}\?)\s*$/mu', $raw, $m3);
        if (! empty($m3[1])) {
            return array_slice($m3[1], 0, 3);
        }

        return [];
    }
}