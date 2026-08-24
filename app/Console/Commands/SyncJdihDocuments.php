<?php

namespace App\Console\Commands;

use App\Models\DokumenHukum;
use App\Services\JdihApiService;
use Illuminate\Console\Command;

class SyncJdihDocuments extends Command
{
    protected $signature = 'jdih:sync {--pages=3 : Jumlah halaman list yang diambil}';

    protected $description = 'Sync dokumen dari API JDIH DIY ke database lokal (scope POC, dibatasi halaman)';

    public function handle(JdihApiService $jdihApi): int
    {
        $maxPages = (int) $this->option('pages');

        $this->info("Mengambil daftar dokumen ({$maxPages} halaman)...");
        $listItems = $jdihApi->getLimitedList($maxPages);
        $this->info('Ditemukan ' . count($listItems) . ' dokumen di list.');

        $bar = $this->output->createProgressBar(count($listItems));
        $bar->start();

        $success = 0;
        $failed = 0;

        foreach ($listItems as $item) {
            $detail = $jdihApi->getDetail($item['slug']);

            if (! $detail) {
                $failed++;
                $bar->advance();
                continue;
            }

            $mapped = $jdihApi->mapToDokumenHukum($detail);

            DokumenHukum::updateOrCreate(
                ['jdih_id' => $mapped['jdih_id']],
                $mapped
            );

            $success++;
            $bar->advance();
        }

        $bar->finish();
        $this->newLine(2);
        $this->info("Selesai. Berhasil: {$success}, Gagal: {$failed}");

        return self::SUCCESS;
    }
}