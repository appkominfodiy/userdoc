<?php
require __DIR__.'/../vendor/autoload.php';
$app = require_once __DIR__.'/../bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

$service = app(\App\Services\RagflowService::class);
$docs = \App\Models\DokumenHukum::whereNotNull('ragflow_document_id')->take(5)->get();
foreach ($docs as $doc) {
    $response = Illuminate\Support\Facades\Http::withHeaders([
        'Authorization' => 'Bearer ' . env('RAGFLOW_API_KEY')
    ])->post(env('RAGFLOW_BASE_URL') . '/api/retrieval', [
        'dataset_ids' => [env('RAGFLOW_DATASET_ID')],
        'document_ids' => [$doc->ragflow_document_id],
        'question' => 'pasal',
        'top_k' => 1,
    ]);
    $json = $response->json();
    if (!empty($json['data']['chunks'])) {
        print_r($json['data']['chunks'][0]);
        break;
    }
}
