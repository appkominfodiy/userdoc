<?php
require __DIR__.'/../vendor/autoload.php';
$app = require_once __DIR__.'/../bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

$service = app(\App\Services\RagflowService::class);
$docs = \App\Models\DokumenHukum::whereNotNull('ragflow_document_id')->take(1)->get();
foreach ($docs as $doc) {
    $datasetId = env('RAGFLOW_DATASET_ID');
    if (empty($datasetId)) $datasetId = $service->ensureDataset();
    $response = Illuminate\Support\Facades\Http::withHeaders([
        'Authorization' => 'Bearer ' . env('RAGFLOW_API_KEY')
    ])->post(env('RAGFLOW_BASE_URL') . '/api/v1/retrieval', [
        'dataset_ids' => [$datasetId],
        'document_ids' => [$doc->ragflow_document_id],
        'question' => 'pasal 7',
        'top_k' => 1,
    ]);
    $json = $response->json();
    if (!empty($json['data']['chunks'])) {
        echo "CONTENT:\n";
        echo $json['data']['chunks'][0]['content'] . "\n\n";
        echo "POSITIONS:\n";
        print_r($json['data']['chunks'][0]['positions']);
        break;
    }
}
