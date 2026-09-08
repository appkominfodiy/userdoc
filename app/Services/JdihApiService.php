<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class JdihApiService
{
    protected string $baseUrl = 'https://spl.jogjaprov.go.id/jdih-etalase/public/produk-hukum';

    /**
     * Ambil daftar dokumen dari endpoint list (paginated).
     * Response asli: {"success", "message", "paging": {page, size, total_item, total_page}, "data": [...]}
     */
    public function getList(int $page = 1): array
    {
        $response = Http::get($this->baseUrl, [
            'page' => $page,
        ]);

        if (! $response->successful()) {
            Log::error('JDIH API list gagal', ['page' => $page, 'status' => $response->status()]);
            return ['data' => [], 'paging' => null];
        }

        return $response->json();
    }

    /**
     * Ambil N halaman pertama saja (untuk POC/testing — total dokumen aslinya
     * 17.960 / 1.796 halaman, JANGAN pakai getAllList() dulu).
     */
    public function getLimitedList(int $maxPages = 3): array
    {
        $allData = [];

        for ($page = 1; $page <= $maxPages; $page++) {
            $result = $this->getList($page);
            $allData = array_merge($allData, $result['data'] ?? []);

            $totalPage = $result['paging']['total_page'] ?? $maxPages;
            if ($page >= $totalPage) {
                break;
            }
        }

        return $allData;
    }

    /**
     * Ambil semua halaman list (HATI-HATI: 1.796 halaman, ~17.960 dokumen).
     * Jangan panggil sampai POC dengan getLimitedList() beres & dites dulu.
     */
    public function getAllList(): array
    {
        $allData = [];
        $page = 1;

        do {
            $result = $this->getList($page);
            $data = $result['data'] ?? [];
            $allData = array_merge($allData, $data);

            $totalPage = $result['paging']['total_page'] ?? $page;
            $hasMore = $page < $totalPage;
            $page++;
        } while ($hasMore);

        return $allData;
    }

    /**
     * Ambil detail 1 dokumen berdasarkan slug.
     * Response API dibungkus: {"success", "message", "data": {...field asli...}}
     * jadi WAJIB extract ['data']-nya, bukan return response mentah.
     */
    public function getDetail(string $slug): ?array
    {
        $response = Http::get("{$this->baseUrl}/{$slug}");

        if (! $response->successful()) {
            Log::error('JDIH API detail gagal', ['slug' => $slug, 'status' => $response->status()]);
            return null;
        }

        return $response->json()['data'] ?? null;
    }

    /**
     * Mapping 1 item dari response DETAIL API (bukan list) ke field
     * tabel dokumen_hukums. Pakai detail karena field jenisnya lebih
     * bersih (singkatan_jenis_peraturan = "PERGUB") dan ada data relasi
     * antar dokumen (peraturan_terkait, keterangan_status).
     */
    public function mapToDokumenHukum(array $detail): array
    {
        return [
            'jdih_id' => $detail['id'],
            'slug' => $detail['slug'],
            'jenis' => $detail['singkatan_jenis_peraturan'] ?: 'Tidak diketahui',
            'nomor' => $detail['nomor'],
            'tahun' => (int) $detail['tahun_terbit'],
            'judul' => $detail['judul_peraturan'],
            'status' => ($detail['status_produk_hukum'] ?? '1') === '1' ? 'berlaku' : 'tidak_berlaku',
            'tanggal_penetapan' => $this->parseTanggalDetail($detail['tanggal_penetapan'] ?? null),
            'tanggal_pengundangan' => $this->parseTanggalDetail($detail['tanggal_pengundangan'] ?? null),
            'penandatangan' => $detail['penandatangan'] ?? null,
            'pemrakarsa' => $detail['pemrakarsa'] ?? null,
            'sumber' => $detail['sumber'] ?? null,
            'teu_badan' => $detail['teu_badan'] ?? null,
            'tempat_penetapan' => $detail['tempat_terbit'] ?? null,
            'lokasi' => $detail['lokasi'] ?? null,
            'bahasa' => $detail['bahasa'] ?? null,
            'bidang_hukum' => $detail['bidang_hukum_name'] ?? null,
            'urusan_pemerintahan' => $detail['urusan_pemerintahan_name'] ?? null,
            'subjek' => $detail['subject'] ?? null,
            'pdf_url' => $detail['file_peraturan'] ?? null,
            'peraturan_terkait' => strip_tags($detail['peraturan_terkait'] ?? ''),
            'dokumen_terkait' => $detail['dokumen_terkait'] ?? null,
            'keterangan_status' => strip_tags($detail['keterangan_status'] ?? ''),
        ];
    }

    /**
     * Parse format tanggal dari endpoint DETAIL: "23-12-2025" (d-m-Y).
     * Beda dengan format di endpoint LIST yang "23 Dec 2025" (d M Y).
     */
    protected function parseTanggalDetail(?string $tanggal): ?string
    {
        if (! $tanggal) {
            return null;
        }

        try {
            return \Carbon\Carbon::createFromFormat('d-m-Y', $tanggal)->format('Y-m-d');
        } catch (\Exception $e) {
            Log::warning('Gagal parse tanggal JDIH (detail)', ['tanggal' => $tanggal]);
            return null;
        }
    }
}