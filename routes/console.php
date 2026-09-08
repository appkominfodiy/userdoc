<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// Jadwalkan otomatis penarikan dokumen baru tiap malam
Artisan::command('jdih:auto-sync', function () {
    $this->call('jdih:sync', ['--pages' => 1]); // Ambil 1 halaman terbaru saja
    $this->call('jdih:push-ragflow');
})->purpose('Sync JDIH API and push to RAGFlow automatically')->dailyAt('01:00');
