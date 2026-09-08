<?php
require __DIR__.'/../vendor/autoload.php';
$app = require_once __DIR__.'/../bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

$docs = \App\Models\DokumenHukum::where('nomor_peraturan', 'like', '%23%')->where('tahun_peraturan', '2023')->get();
foreach ($docs as $doc) {
    echo "ID: " . $doc->id . " Judul: " . substr($doc->judul, 0, 50) . " RAGID: " . $doc->ragflow_document_id . "\n";
}
