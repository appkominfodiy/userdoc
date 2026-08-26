<?php

namespace App\Console\Commands;

use App\Models\DokumenHukum;
use App\Services\RagflowService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Http;

class SyncRagflowMapping extends Command
{
    protected $signature = 'jdih:sync-mapping';
    protected $description = 'Sinkronkan ragflow_document_id dari server RAGFlow berdasarkan nama file dokumen';

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

        $allLocal = DokumenHukum::all();
        $matched = 0;
        $notMatched = [];

        foreach ($ragflowDocs as $doc) {
            $docName = $doc['name']; // contoh: "KEPGUB_442_2025.pdf"

            // Cocokkan dengan pola nama file lokal yang sebenarnya dipakai saat upload:
            // {JENIS}_{NOMOR}_{TAHUN}.pdf
            $local = $allLocal->first(function ($d) use ($docName) {
                $expectedName = strtoupper($d->jenis) . '_' . $d->nomor . '_' . $d->tahun . '.pdf';
                return strcasecmp($expectedName, $docName) === 0;
            });

            if ($local) {
                $oldId = $local->ragflow_document_id;
                $local->ragflow_document_id = $doc['id'];
                $local->sync_status = 'parsed';
                $local->save();
                $matched++;
                $this->line("✓ {$docName}: {$oldId} -> {$doc['id']}");
            } else {
                $notMatched[] = $docName;
            }
        }

        $this->info("Selesai. {$matched} dokumen ter-mapping.");

        if (! empty($notMatched)) {
            $this->warn('Tidak ketemu pasangan lokal untuk: ' . implode(', ', $notMatched));
        }

        return 0;
    }
}