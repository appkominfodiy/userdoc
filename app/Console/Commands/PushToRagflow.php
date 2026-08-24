<?php

namespace App\Console\Commands;

use App\Models\DokumenHukum;
use App\Services\RagflowService;
use Illuminate\Console\Command;

class PushToRagflow extends Command
{
    protected $signature = 'jdih:push-ragflow';

    protected $description = 'Upload dokumen dari database lokal ke RAGFlow dan trigger parsing';

    public function handle(RagflowService $ragflow): int
    {
        $this->info('Menyiapkan dataset "jdih_public" di RAGFlow...');
        $datasetId = $ragflow->ensureDataset();
        $this->info("Dataset siap (ID: {$datasetId}).");

        $documents = DokumenHukum::where('sync_status', 'pending')->get();
        $this->info('Ditemukan ' . $documents->count() . ' dokumen yang belum di-push.');

        $bar = $this->output->createProgressBar($documents->count());
        $bar->start();

        $uploadedIds = [];
        $success = 0;
        $failed = 0;

        foreach ($documents as $doc) {
            if (! $doc->pdf_url) {
                $doc->update(['sync_status' => 'failed']);
                $failed++;
                $bar->advance();
                continue;
            }

            try {
                $fileName = "{$doc->jenis}_{$doc->nomor}_{$doc->tahun}.pdf";
                $ragflowDocId = $ragflow->uploadDocument($datasetId, $doc->pdf_url, $fileName);

                if (! $ragflowDocId) {
                    $doc->update(['sync_status' => 'failed']);
                    $failed++;
                    $bar->advance();
                    // tetap kasih jeda meski gagal, biar server JDIH nggak makin dibebani
                    sleep(2);
                    continue;
                }

                $doc->update([
                    'ragflow_document_id' => $ragflowDocId,
                    'sync_status' => 'uploaded',
                    'last_synced_at' => now(),
                ]);

                $uploadedIds[] = $ragflowDocId;
                $success++;
            } catch (\Throwable $e) {
                $doc->update(['sync_status' => 'failed']);
                $failed++;
                $this->newLine();
                $this->warn("Gagal: {$doc->judul} — " . $e->getMessage());
            }

            $bar->advance();

            // Jeda 2 detik antar dokumen — server JDIH kelihatan sensitif
            // terhadap request beruntun cepat.
            sleep(2);
        }

        $bar->finish();
        $this->newLine(2);
        $this->info("Upload selesai. Berhasil: {$success}, Gagal: {$failed}");

        if (! empty($uploadedIds)) {
            $this->info('Memicu parsing untuk ' . count($uploadedIds) . ' dokumen...');
            $parseOk = $ragflow->triggerParse($datasetId, $uploadedIds);

            if ($parseOk) {
                DokumenHukum::whereIn('ragflow_document_id', $uploadedIds)
                    ->update(['sync_status' => 'parsed']);
                $this->info('Parsing berhasil dipicu untuk semua dokumen.');
            } else {
                $this->error('Gagal memicu parsing. Cek log Laravel untuk detail.');
            }
        }

        if ($failed > 0) {
            $this->comment("Ada {$failed} dokumen gagal. Untuk coba ulang, jalankan command ini lagi — dokumen berstatus 'failed' bisa direset manual ke 'pending' dulu lewat tinker kalau perlu.");
        }

        return self::SUCCESS;
    }
}