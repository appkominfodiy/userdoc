<?php

namespace App\Console\Commands;

use App\Models\DokumenHukum;
use App\Services\RagflowService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Http;

class SyncRagflowMapping extends Command
{
    protected $signature = 'jdih:sync-mapping';
    protected $description = 'Sinkronkan ragflow_document_id dari server RAGFlow berdasarkan judul dokumen';

    public function handle(RagflowService $ragflow)
    {
        $baseUrl = rtrim(config('services.ragflow.base_url'), '/');
        $apiKey = config('services.ragflow.api_key');

        // Ambil dataset
        $datasetResponse = Http::withHeaders(['Authorization' => 'Bearer ' . $apiKey])
            ->get("{$baseUrl}/api/v1/datasets", ['name' => 'jdih_public']);

        $datasets = $datasetResponse->json('data') ?? [];
        if (empty($datasets)) {
            $this->error('Dataset jdih_public tidak ditemukan di server RAGFlow.');
            return 1;
        }
        $datasetId = $datasets[0]['id'];

        // Ambil semua dokumen dari RAGFlow
        $docsResponse = Http::withHeaders(['Authorization' => 'Bearer ' . $apiKey])
            ->get("{$baseUrl}/api/v1/datasets/{$datasetId}/documents", ['page_size' => 100]);

        $ragflowDocs = $docsResponse->json('data.docs') ?? [];
        $this->info('Dokumen di RAGFlow: ' . count($ragflowDocs));

        // Mapping berdasarkan nama file
        $matched = 0;
        foreach ($ragflowDocs as $doc) {
            $docName = $doc['name'];

            // Cari dokumen di database lokal yang cocok
            $local = DokumenHukum::where('ragflow_document_id', null)
                ->get()
                ->first(function ($d) use ($docName) {
                    $localName = $d->nomor . '_' . $d->tahun . '.pdf';
                    return str_contains($docName, $d->nomor) && str_contains($docName, (string)$d->tahun);
                });

            if ($local) {
                $local->ragflow_document_id = $doc['id'];
                $local->sync_status = 'synced';
                $local->save();
                $matched++;
                $this->line("✓ {$local->nomor}/{$local->tahun} -> {$doc['id']}");
            }
        }

        $this->info("Selesai. {$matched} dokumen ter-mapping.");
        return 0;
    }
}