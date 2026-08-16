<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class RagflowService
{
    protected string $baseUrl;
    protected string $apiKey;
    protected string $datasetName = 'jdih_public';

    protected string $ollamaUrl;
    protected string $ollamaModel;

    public function __construct()
    {
        $this->baseUrl = rtrim(config('services.ragflow.base_url'), '/');
        $this->apiKey = config('services.ragflow.api_key');

        $this->ollamaUrl = rtrim(config('jdih_prompts.ollama.base_url', 'http://localhost:11434'), '/');
        $this->ollamaModel = config('jdih_prompts.ollama.model', 'qwen2.5:3b');
    }

    protected function headers(): array
    {
        return [
            'Authorization' => 'Bearer ' . $this->apiKey,
        ];
    }

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
     * Retrieval chunk dari RAGFlow, di-rerank: chunk yang MEMBUKA pasal
     * yang ditanya diprioritaskan. top_k = 12 biar pasal yang benar ikut masuk.
     */
    public function retrieveChunks(string $documentId, string $question, int $topK = 12): array
    {
        $datasetId = $this->ensureDataset();

        $response = Http::withHeaders($this->headers())
            ->timeout(30)
            ->post("{$this->baseUrl}/api/v1/retrieval", [
                'question' => $question,
                'dataset_ids' => [$datasetId],
                'document_ids' => [$documentId],
                'top_k' => $topK,
                'similarity_threshold' => 0.1,
                'vector_similarity_weight' => 0.3,
            ]);

        if (! $response->successful()) {
            Log::error('Gagal retrieval RAGFlow', [
                'document_id' => $documentId,
                'response' => $response->body(),
            ]);
            return [];
        }

        $chunks = $response->json('data.chunks') ?? [];

        // RERANK: prioritaskan chunk yang membuka pasal yang ditanya
        $chunks = $this->prioritizePasal($chunks, $question);

        // DEBUG: lihat 3 chunk teratas yang akan dikirim ke AI
        $previews = [];
        foreach (array_slice($chunks, 0, 3) as $c) {
            $previews[] = substr(preg_replace('/\s+/', ' ', $c['content'] ?? ''), 0, 120);
        }
        Log::info('Top chunks setelah rerank: ', $previews);

        // 3 chunk terbaik saja biar konteks pendek = Ollama cepat
        return array_slice($chunks, 0, 3);
    }

    protected function prioritizePasal(array $chunks, string $question): array
    {
        if (! preg_match('/pasal\s*(\d+)/i', $question, $m)) {
            return $chunks;
        }

        $n = $m[1];

        usort($chunks, fn ($a, $b) => $this->pasalScore($b, $n) <=> $this->pasalScore($a, $n));

        return $chunks;
    }

    protected function pasalScore(array $chunk, string $n): int
    {
        $content = $chunk['content'] ?? '';

        $mentions = preg_match('/Pasal\s*'.$n.'\b/i', $content);
        $onlyRef = preg_match('/dimaksud\s+dalam\s+Pasal\s*'.$n.'\b/i', $content);

        if ($mentions && ! $onlyRef) {
            return 2; // membuka pasal = isi substansi
        }
        if ($mentions) {
            return 1; // hanya merujuk
        }

        return 0;
    }

    protected function isOutOfScope(string $question): ?string
    {
        $keywords = config('jdih_prompts.out_of_scope_keywords', []);
        $questionLower = strtolower($question);

        foreach ($keywords as $keyword) {
            if (str_contains($questionLower, strtolower($keyword))) {
                return $keyword;
            }
        }

        return null;
    }

    /**
     * Tanya-jawab per dokumen: retrieval RAGFlow + generation Ollama lokal.
     */
    public function askDocument(string $documentId, string $question): string
    {
        $minLength = config('jdih_prompts.min_question_length', 10);
        if (strlen(trim($question)) < $minLength) {
            return config('jdih_prompts.negative_responses.too_vague');
        }

        $outOfScopeKeyword = $this->isOutOfScope($question);
        if ($outOfScopeKeyword) {
            return str_replace(
                '{topic}',
                $outOfScopeKeyword,
                config('jdih_prompts.negative_responses.out_of_scope')
            );
        }

        try {
            $chunks = $this->retrieveChunks($documentId, $question);
        } catch (\Exception $e) {
            Log::error('Error saat retrieval', ['exception' => $e->getMessage()]);
            return config('jdih_prompts.negative_responses.technical_error');
        }

        if (empty($chunks)) {
            return str_replace(
                '{question}',
                $question,
                config('jdih_prompts.negative_responses.no_context')
            );
        }

        $context = collect($chunks)
            ->pluck('content')
            ->filter()
            ->implode("\n\n---\n\n");

        $systemPrompt = config('jdih_prompts.system');
        $userPrompt = str_replace(
            ['{context}', '{question}'],
            [$context, $question],
            config('jdih_prompts.user_template')
        );

        try {
            $response = Http::timeout(280)->post("{$this->ollamaUrl}/api/generate", [
                'model' => $this->ollamaModel,
                'prompt' => $userPrompt,
                'system' => $systemPrompt,
                'stream' => false,
                'options' => [
                    'temperature' => 0.2,
                    'num_predict' => 400,
                    'num_ctx' => 3072,
                ],
            ]);

            if ($response->successful()) {
                return $response->json('response') ?? 'Tidak ada jawaban.';
            }

            Log::error('Ollama gagal menjawab', [
                'status' => $response->status(),
                'body' => $response->body(),
            ]);
        } catch (\Exception $e) {
            Log::error('Exception saat panggil Ollama', [
                'error' => $e->getMessage(),
            ]);
        }

        return config('jdih_prompts.negative_responses.technical_error');
    }
}