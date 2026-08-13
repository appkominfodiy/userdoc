<?php

namespace App\Http\Controllers;

use Inertia\Inertia;

class JdihController extends Controller
{
    public function index()
    {
        // 🔸 SEMENTARA: data contoh dulu untuk tes tampilan.
        //    Nanti kita ganti dengan API JDIH kamu yang asli.
        $dokumen = [
            [
                'id' => 18023,
                'kategori_hukum_name' => 'Peraturan Gubernur',
                'nomor' => '26',
                'tahun_terbit' => '2026',
                'judul_peraturan' => 'Peraturan Gubernur DIY Nomor 26 Tahun 2026 Tentang Perubahan Atas Peraturan Gubernur DIY Nomor 64 Tahun 2024',
                'tanggal_pengundangan' => '08 Jul 2026',
                'file_peraturan' => 'https://spl.jogjaprov.go.id/jdih-etalase/media/view/produk-hukum/file_peraturan/2026pg0034026.pdf',
            ],
        ];

        return Inertia::render('Jdih/Index', ['dokumen' => $dokumen]);
    }
}