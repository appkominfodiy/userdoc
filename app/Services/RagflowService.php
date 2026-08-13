<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class RagflowService
{
    protected string $baseUrl;
    protected string $apiKey;
    protected string $datasetName = 'jdih_public';

    protected string $openrouterKey;
    protected string $openrouterUrl;

    // Model gratis OpenRouter, dicoba urut kalau satu kena rate limit.
    protected array $fallbackModels = [
        'google/gemma-4-31b-it:free',
        'nvidia/nemotron-3-nano-30b-a3b:free',
        'openai/gpt-oss-20b:free',
        'cohere/north-mini-code:free',
    ];

    public function __construct()
    {
        $this->baseUrl = rtrim(config('services.ragflow.base_url'), '/');
        $this->apiKey = config('services.ragflow.api_key');

        $this->openrouterKey = config('services.openrouter.api_key');
        $this->openrouterUrl = rtrim(config('services.openrouter.base_url'), '/');
    }

    protected function headers(): array
    {
        return [
            'Authorization' => 'Bearer ' . $this->apiKey,
        ];
    }

    /**
     * Cari dataset "jdih_public" — kalau belum ada, buat baru dengan
     * chunk_method "laws" sesuai rekomendasi pembimbing untuk dokumen hukum.
     */
    public function ensureDataset(): string
    {
        $response = Http::withHeaders($this->headers())
            ->get("{$this->baseUrl}/api/v1/datasets", [
                'name' => $this->datasetName,
            ]);

        $existing = $response->json('data') ?? [];

        if (! empty($existing)) {
            return $existing[0]['id'];
        }

        $createResponse = Http::withHeaders($this->headers())
            ->post("{$this->baseUrl}/api/v1/datasets", [
                'name' => $this->datasetName,
                'chunk_method' => 'laws',
            ]);

        if (! $createResponse->successful()) {
            Log::error('Gagal membuat dataset RAGFlow', ['response' => $createResponse->body()]);
            throw new \RuntimeException('Gagal membuat dataset RAGFlow: ' . $createResponse->body());
        }

        return $createResponse->json('data.id');
    }

    /**
     * Download PDF dari URL JDIH, lalu upload ke dataset RAGFlow.
     * Mengembalikan document_id RAGFlow kalau berhasil.
     */
    public function uploadDocument(string $datasetId, string $pdfUrl, string $fileName): ?string
    {
        $pdfResponse = Http::timeout(180)->connectTimeout(20)->retry(2, 2000)->get($pdfUrl);

        if (! $pdfResponse->successful()) {
            Log::error('Gagal download PDF', ['url' => $pdfUrl, 'status' => $pdfResponse->status()]);
            return null;
        }

        $response = Http::withHeaders($this->headers())
            ->attach('file', $pdfResponse->body(), $fileName)
            ->post("{$this->baseUrl}/api/v1/datasets/{$datasetId}/documents");

        if (! $response->successful()) {
            Log::error('Gagal upload dokumen ke RAGFlow', [
                'file' => $fileName,
                'response' => $response->body(),
            ]);
            return null;
        }

        $data = $response->json('data');

        return $data[0]['id'] ?? null;
    }

    /**
     * Trigger parsing untuk 1 atau lebih document_id di dataset tertentu.
     */
    public function triggerParse(string $datasetId, array $documentIds): bool
    {
        $response = Http::withHeaders($this->headers())
            ->post("{$this->baseUrl}/api/v1/datasets/{$datasetId}/chunks", [
                'document_ids' => $documentIds,
            ]);

        if (! $response->successful()) {
            Log::error('Gagal trigger parse RAGFlow', [
                'document_ids' => $documentIds,
                'response' => $response->body(),
            ]);
            return false;
        }

        return true;
    }

    /**
     * Ambil chunk relevan dari RAGFlow, DIBATASI cuma ke 1 dokumen tertentu
     * (document_ids) — ini yang bikin chat ter-scope per dokumen, bukan
     * nyari ke seluruh dataset jdih_public.
     */
    public function retrieveChunks(string $documentId, string $question, int $topK = 6): array
    {
        $datasetId = $this->ensureDataset();

        $response = Http::withHeaders($this->headers())
            ->post("{$this->baseUrl}/api/v1/retrieval", [
                'question' => $question,
                'dataset_ids' => [$datasetId],
                'document_ids' => [$documentId],
                'top_k' => $topK,
            ]);

        if (! $response->successful()) {
            Log::error('Gagal retrieval RAGFlow', [
                'document_id' => $documentId,
                'response' => $response->body(),
            ]);
            return [];
        }

        return $response->json('data.chunks') ?? [];
    }

    /**
     * Cek apakah pertanyaan di luar scope peraturan DIY.
     */
    protected function isOutOfScope(string $question): ?string
    {
        $keywords = config('jdih_prompts.out_of_scope_keywords', []);
        $questionLower = strtolower($question);

        foreach ($keywords as $keyword) {
            if (str_contains($questionLower, strtolower($keyword))) {
                return $keyword; // kembalikan keyword yang terdeteksi
            }
        }

        return null;
    }

    /**
     * Tanya-jawab yang di-scope ke 1 dokumen: ambil chunk relevan dari
     * RAGFlow, susun sebagai konteks, lalu minta LLM menjawab HANYA
     * berdasarkan konteks itu. Pakai prompt template dari config.
     */
    public function askDocument(string $documentId, string $question): string
    {
        // === 1. Deteksi pertanyaan terlalu pendek / ambigu ===
        $minLength = config('jdih_prompts.min_question_length', 10);
        if (strlen(trim($question)) < $minLength) {
            return config('jdih_prompts.negative_responses.too_vague');
        }

        // === 2. Deteksi pertanyaan di luar scope hukum ===
        $outOfScopeKeyword = $this->isOutOfScope($question);
        if ($outOfScopeKeyword) {
            return str_replace(
                '{topic}',
                $outOfScopeKeyword,
                config('jdih_prompts.negative_responses.out_of_scope')
            );
        }

        // === 3. Retrieval chunks dari RAGFlow ===
        try {
            $chunks = $this->retrieveChunks($documentId, $question);
        } catch (\Exception $e) {
            Log::error('Error saat retrieval', ['exception' => $e->getMessage()]);
            return config('jdih_prompts.negative_responses.technical_error');
        }

        // === 4. Kalau tidak ada chunk relevan ===
        if (empty($chunks)) {
            return str_replace(
                '{question}',
                $question,
                config('jdih_prompts.negative_responses.no_context')
            );
        }

        // === 5. Susun konteks dari chunks ===
        $context = collect($chunks)
            ->pluck('content')
            ->filter()
            ->implode("\n\n---\n\n");

        // === 6. Ambil prompt template dari config ===
        $systemPrompt = config('jdih_prompts.system');
        $userPrompt = str_replace(
            ['{context}', '{question}'],
            [$context, $question],
            config('jdih_prompts.user_template')
        );

        // === 7. Panggil LLM (OpenRouter untuk sekarang) ===
        foreach ($this->fallbackModels as $model) {
            try {
                $response = Http::withHeaders([
                    'Authorization' => 'Bearer ' . $this->openrouterKey,
                    'Content-Type' => 'application/json',
                ])->timeout(60)->post("{$this->openrouterUrl}/chat/completions", [
                    'model' => $model,
                    'messages' => [
                        ['role' => 'system', 'content' => $systemPrompt],
                        ['role' => 'user', 'content' => $userPrompt],
                    ],
                ]);

                if ($response->successful()) {
                    return $response->json('choices.0.message.content') ?? 'Tidak ada jawaban.';
                }

                Log::warning('Model OpenRouter gagal, coba fallback berikutnya', [
                    'model' => $model,
                    'status' => $response->status(),
                ]);
            } catch (\Exception $e) {
                Log::error('Exception saat panggil OpenRouter', [
                    'model' => $model,
                    'error' => $e->getMessage(),
                ]);
            }
        }

        // === 8. Kalau semua model gagal ===
        return config('jdih_prompts.negative_responses.technical_error');
    }
}