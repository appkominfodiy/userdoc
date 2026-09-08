<?php

namespace App\Services;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class RagflowService
{
    protected string $baseUrl;
    protected string $apiKey;
    protected string $datasetName = 'jdih_public';

    protected string $ollamaUrl;
    protected $ollamaModel;
    protected $ollamaFastModel;

    public function __construct()
    {
        $this->baseUrl = rtrim(env('RAGFLOW_BASE_URL'), '/');
        $this->apiKey = env('RAGFLOW_API_KEY');
        
        $this->ollamaUrl = rtrim(config('jdih_prompts.ollama.base_url', 'http://100.65.5.110:11434'), '/');
        $this->ollamaModel = config('jdih_prompts.ollama.model', 'qwen3.5:4b');
        $this->ollamaFastModel = config('jdih_prompts.ollama.fast_model', 'qwen2.5:1.5b');
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
        $tempFile = tempnam(sys_get_temp_dir(), 'jdih_pdf_');
        
        $pdfResponse = Http::timeout(180)->connectTimeout(20)->retry(2, 2000)
            ->withOptions(['sink' => $tempFile])
            ->get($pdfUrl);

        if (! $pdfResponse->successful()) {
            Log::error('Gagal download PDF', ['url' => $pdfUrl, 'status' => $pdfResponse->status()]);
            @unlink($tempFile);
            return null;
        }

        $fileStream = fopen($tempFile, 'r');

        $response = Http::withHeaders($this->headers())
            ->timeout(300)
            ->attach('file', $fileStream, $fileName)
            ->post("{$this->baseUrl}/api/v1/datasets/{$datasetId}/documents");

        if (is_resource($fileStream)) {
            fclose($fileStream);
        }
        @unlink($tempFile);

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
     *
     * UPGRADE: Return metadata lengkap untuk sitasi (page, chunk_id, snippet)
     */
    public function retrieveChunks(string $documentId, string $question, int $topK = 30): array
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

        // UPGRADE: Return 3 chunk terbaik dengan metadata lengkap untuk sitasi
        return array_map(function ($chunk) {
            $page = $chunk['page_num'] ?? $chunk['page'] ?? null;
            if (!$page && !empty($chunk['positions'])) {
                foreach ($chunk['positions'] as $pos) {
                    $parts = is_string($pos) ? explode("\t", $pos) : (is_array($pos) ? $pos : []);
                    if (isset($parts[0]) && is_numeric($parts[0])) {
                        $page = (int) $parts[0];
                        break;
                    } elseif (is_numeric($pos)) {
                        $page = (int) $pos;
                        break;
                    }
                }
            }

            return [
                'content' => $chunk['content'] ?? '',
                'page' => $page,
                'positions' => $chunk['positions'] ?? [],
                'chunk_id' => $chunk['chunk_id'] ?? $chunk['id'] ?? null,
                'document_name' => $chunk['document_name'] ?? null,
                'similarity' => $chunk['similarity'] ?? null,
            ];
        }, array_slice($chunks, 0, 3));
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

        // Deteksi apakah "Pasal X" ada di awal baris (bisa ada spasi sebelumnya)
        $isOpening = preg_match('/^\s*Pasal\s*'.$n.'\b/im', $content);

        // Deteksi apakah ini sekadar rujukan ke pasal X
        $isReferencing = preg_match('/(dimaksud\s+(dalam|pada)|ketentuan|diatur\s+(dalam|pada)|berdasarkan|sesuai\s+(dengan)?)\s+pasal\s*'.$n.'\b/i', $content);

        if ($isOpening) {
            return 100; // Sangat relevan, ini adalah deklarasi pasal
        }

        $mentions = preg_match('/Pasal\s*'.$n.'\b/i', $content);

        if ($mentions && ! $isReferencing) {
            return 10; // Menyebut pasal tapi bukan sekadar rujukan (mungkin teks lanjutannya)
        }
        
        if ($mentions) {
            return 1; // Hanya merujuk pasal
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
     *
     * UPGRADE: Return structured response dengan answer + references array
     */
    public function askDocument(\App\Models\DokumenHukum $dokumen, string $question): array
    {
        $documentId = $dokumen->ragflow_document_id;
        
        // Cek jika hanya sapaan singkat (Fast bypass)
        $cleanQuestion = strtolower(trim(preg_replace('/[^a-z0-9 ]/i', '', $question)));
        $greetings = ['halo', 'hai', 'hi', 'selamat pagi', 'selamat siang', 'selamat sore', 'selamat malam', 'pagi', 'siang', 'sore', 'malam', 'hello', 'ping', 'tes', 'test', 'halo admin', 'hai admin'];
        
        if (in_array($cleanQuestion, $greetings)) {
            $responses = [
                "Halo! 👋 Ada yang bisa saya bantu terkait isi dokumen ini?",
                "Hai! Monggo, apa ada pertanyaan tentang peraturan yang sedang Anda baca?",
                "Halo! Selamat datang. Ada pasal atau kalimat yang ingin saya jelaskan?",
                "Hai Bapak/Ibu! Silakan tanyakan apa saja seputar dokumen ini, saya siap membantu.",
                "Halo! Monggo, mau tanya soal apa nih di peraturan ini?"
            ];
            return [
                'answer' => $responses[array_rand($responses)],
                'references' => [],
            ];
        }

        $outOfScopeKeyword = $this->isOutOfScope($question);
        if ($outOfScopeKeyword) {
            return [
                'answer' => str_replace(
                    '{topic}',
                    $outOfScopeKeyword,
                    config('jdih_prompts.negative_responses.out_of_scope')
                ),
                'references' => [],
            ];
        }

        $cacheKey = 'chat_doc_' . $dokumen->id . '_q_' . md5($cleanQuestion);

        return Cache::remember($cacheKey, 86400, function () use ($dokumen, $documentId, $question) {
            try {
                $chunks = $this->retrieveChunks($documentId, $question);
            } catch (\Exception $e) {
                Log::error('Error saat retrieval', ['exception' => $e->getMessage()]);
                return [
                    'answer' => config('jdih_prompts.negative_responses.technical_error'),
                    'references' => [],
                ];
            }

            $metadata = "INFORMASI DOKUMEN SAAT INI:\n"
                      . "- Judul: {$dokumen->judul}\n"
                      . "- Jenis: {$dokumen->jenis}\n"
                      . "- Nomor/Tahun: {$dokumen->nomor} Tahun {$dokumen->tahun}\n"
                      . "- Status: {$dokumen->status}\n\n";

            if (empty($chunks)) {
                $context = $metadata . "*(Tidak ada cuplikan teks spesifik dari dokumen yang relevan ditemukan untuk pertanyaan ini. Jawab berdasarkan informasi dokumen di atas saja.)*";
            } else {
                $context = $metadata;
                foreach ($chunks as $index => $chunk) {
                    $num = $index + 1;
                    $context .= "SUMBER [{$num}]:\n" . trim($chunk['content']) . "\n\n";
                }
            }

            $systemPrompt = config('jdih_prompts.system');
            $userPrompt = str_replace(
                ['{context}', '{question}'],
                [$context, $question],
                config('jdih_prompts.user_template')
            );

            // UPGRADE: gabung system + user prompt jadi satu string.
            // Model kecil (qwen3.5:4b) lebih konsisten mengikuti instruksi
            // kalau semuanya jadi satu prompt, dibanding pakai parameter
            // 'system' terpisah yang kadang "bocor" jadi bagian jawaban.
            $combinedPrompt = $systemPrompt . "\n\n" . $userPrompt . "\n\nPENTING: Anda WAJIB menyertakan nomor sumber (contoh: [1] atau [2]) pada setiap kalimat yang menggunakan informasi dari SUMBER di atas!\n\n/no_think";

            // DEBUG SEMENTARA
            Log::info('DEBUG askDocument sebelum panggil Ollama', [
                'model' => $this->ollamaModel,
                'ollama_url' => $this->ollamaUrl,
                'context_length_chars' => strlen($context),
                'combined_prompt_length_chars' => strlen($combinedPrompt),
            ]);

            try {
                $response = Http::timeout(280)->post("{$this->ollamaUrl}/api/generate", [
                    'model' => $this->ollamaModel,
                    'prompt' => $combinedPrompt,
                    'stream' => false,
                    'think' => false,
                    'options' => [
                        'temperature' => 0.2,
                        'num_predict' => 800,
                        'num_ctx' => 8192,
                    ],
                ]);

                // DEBUG SEMENTARA
                Log::info('DEBUG askDocument respons mentah Ollama', [
                    'status' => $response->status(),
                    'successful' => $response->successful(),
                    'done_reason' => $response->json('done_reason'),
                    'response_text' => $response->json('response'),
                ]);

                if ($response->successful()) {
                    $answer = $response->json('response') ?? 'Tidak ada jawaban.';

                    // UPGRADE: Build references array dengan nomor urut
                    $allReferences = array_map(function ($chunk, $index) {
                        return [
                            'id' => $index + 1, // [1], [2], [3]
                            'page' => $chunk['page'],
                            'chunk_id' => $chunk['chunk_id'],
                            'snippet' => substr($chunk['content'], 0, 150) . '...',
                            'original_chunk' => $chunk,
                        ];
                    }, $chunks, array_keys($chunks));

                    // Filter referensi agar hanya menampilkan yang benar-benar dikutip oleh LLM (contoh: [1], [2])
                    preg_match_all('/\[(\d+)\]/', $answer, $matches);
                    if (!empty($matches[1])) {
                        $citedIds = array_unique(array_map('intval', $matches[1]));
                        $candidates = array_filter($allReferences, function ($ref) use ($citedIds) {
                            return in_array($ref['id'], $citedIds);
                        });
                    } else {
                        // Jika LLM tidak memberikan kutipan angka, periksa SEMUA chunk yang diretriever
                        $candidates = $allReferences;
                    }

                    // UPGRADE: Faithfulness Check & Span-Level Citation
                    $verifiedReferences = [];
                    foreach ($candidates as $ref) {
                        $isFaithful = $this->verifyFaithfulness($question, $answer, $ref, $ref['original_chunk']);
                        unset($ref['original_chunk']); // Hapus original_chunk dari response akhir
                        
                        if ($isFaithful) {
                            $verifiedReferences[] = $ref;
                        }
                    }

                    // Jika LLM halusinasi sepenuhnya (tidak ada chunk yang support)
                    if (count($references) > 0 && count($verifiedReferences) === 0) {
                        return [
                            'answer' => "Maaf, setelah saya verifikasi kembali, saya tidak menemukan landasan yang cukup kuat di dalam dokumen ini untuk menjawab pertanyaan Anda secara pasti.",
                            'references' => [],
                        ];
                    }

                    return [
                        'answer' => $answer,
                        'references' => $verifiedReferences,
                    ];
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

            return [
                'answer' => config('jdih_prompts.negative_responses.technical_error'),
                'references' => [],
            ];
        });
    }

    /**
     * Verifikasi entalment dan ekstrak nomor baris untuk Span-Level Citation.
     */
    protected function verifyFaithfulness(string $question, string $answer, array &$reference, array $originalChunk): bool
    {
        $chunkLines = explode("\n", $originalChunk['content'] ?? '');
        $numberedContent = "";
        foreach ($chunkLines as $i => $line) {
            $lineStr = trim($line);
            if (!empty($lineStr)) {
                $numberedContent .= "[{$i}] {$lineStr}\n";
            }
        }

        $prompt = <<<PROMPT
Anda adalah asisten verifikator fakta yang teliti.
Tugas Anda adalah memverifikasi apakah Jawaban AI didukung oleh Teks Sumber, dan mencari nomor baris spesifik yang menjadi bukti.

Pertanyaan User: {$question}
Jawaban AI: {$answer}

Teks Sumber (dengan nomor baris):
{$numberedContent}

Instruksi:
1. Evaluasi apakah klaim dalam Jawaban AI didukung oleh Teks Sumber di atas.
2. Jawab YES jika didukung, NO jika Teks Sumber tidak relevan atau tidak mendukung.
3. Jika YES, sebutkan nomor-nomor baris (angka saja, pisahkan dengan koma) yang menjadi BUKTI KUAT untuk jawaban tersebut.

Format Output WAJIB persis seperti ini (2 baris):
SUPPORTED: YES
LINES: 1, 2
(Jika tidak didukung, cukup balas SUPPORTED: NO)
PROMPT;

        try {
            $response = Http::timeout(60)->post("{$this->ollamaUrl}/api/generate", [
                'model' => $this->ollamaFastModel,
                'prompt' => $prompt,
                'stream' => false,
                'options' => [
                    'temperature' => 0.0,
                    'num_predict' => 50,
                ],
            ]);

            if ($response->successful()) {
                $verif = $response->json('response') ?? '';
                $isSupported = str_contains(strtoupper($verif), 'SUPPORTED: YES');
                
                if (!$isSupported) return false;

                // Ekstrak baris-baris spesifik untuk Span-Level Citation
                $x0 = $x1 = $y0 = $y1 = null;
                $positions = $originalChunk['positions'] ?? [];

                if (preg_match('/LINES:\s*([\d,\s]+)/i', $verif, $m)) {
                    $lineNumbers = array_map('intval', explode(',', $m[1]));
                    
                    // Hitung bounding box hanya dari baris-baris ini
                    foreach ($lineNumbers as $idx) {
                        if (isset($positions[$idx])) {
                            $pos = $positions[$idx];
                            $parts = is_string($pos) ? explode("\t", $pos) : (is_array($pos) ? $pos : []);
                            if (count($parts) >= 5) {
                                $px0 = (float) $parts[1];
                                $px1 = (float) $parts[2];
                                $py0 = (float) $parts[3];
                                $py1 = (float) $parts[4];
                                $x0 = $x0 === null ? $px0 : min($x0, $px0);
                                $x1 = $x1 === null ? $px1 : max($x1, $px1);
                                $y0 = $y0 === null ? $py0 : min($y0, $py0);
                                $y1 = $y1 === null ? $py1 : max($y1, $py1);
                            }
                        }
                    }
                }

                // Jika gagal parsing baris, fallback ke semua posisi dalam chunk (Bounding box untuk keseluruhan chunk)
                if ($x0 === null) {
                    foreach ($positions as $pos) {
                        $parts = is_string($pos) ? explode("\t", $pos) : (is_array($pos) ? $pos : []);
                        if (count($parts) >= 5) {
                            $px0 = (float) $parts[1];
                            $px1 = (float) $parts[2];
                            $py0 = (float) $parts[3];
                            $py1 = (float) $parts[4];
                            $x0 = $x0 === null ? $px0 : min($x0, $px0);
                            $x1 = $x1 === null ? $px1 : max($x1, $px1);
                            $y0 = $y0 === null ? $py0 : min($y0, $py0);
                            $y1 = $y1 === null ? $py1 : max($y1, $py1);
                        }
                    }
                }

                $reference['x0'] = $x0;
                $reference['x1'] = $x1;
                $reference['y0'] = $y0;
                $reference['y1'] = $y1;

                return true;
            }
        } catch (\Exception $e) {
            Log::error('Gagal saat verifikasi faithfulness', ['error' => $e->getMessage()]);
        }

        // Kalau gagal atau error, kembalikan false agar tidak menyorot dokumen yang salah
        return false; 
    }
}