<?php
require __DIR__.'/../vendor/autoload.php';
$app = require_once __DIR__.'/../bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

$docs = \App\Models\DokumenHukum::where('judul', 'like', '%23 Tahun 2023%')->get();
if ($docs->isEmpty()) {
    $docs = \App\Models\DokumenHukum::where('nomor_peraturan', 'like', '%23%')->where('tahun_peraturan', '2023')->get();
}

foreach ($docs as $doc) {
    if (!$doc->ragflow_document_id) continue;
    echo "Querying RAGFlow for doc ID: " . $doc->ragflow_document_id . "\n";
    
    $service = app(\App\Services\RagflowService::class);
    $reflection = new \ReflectionClass($service);
    
    // get datasetId
    $prop = $reflection->getProperty('datasetId');
    $prop->setAccessible(true);
    $datasetId = $prop->getValue($service);
    
    $response = Illuminate\Support\Facades\Http::withHeaders([
        'Authorization' => 'Bearer ' . env('RAGFLOW_API_KEY')
    ])->post(env('RAGFLOW_BASE_URL') . '/api/v1/retrieval', [
        'dataset_ids' => [$datasetId],
        'document_ids' => [$doc->ragflow_document_id],
        'question' => 'peraturan',
        'top_k' => 1,
    ]);
    
    $json = $response->json();
    if (!empty($json['data']['chunks'])) {
        file_put_contents(__DIR__ . '/rag_out.json', json_encode($json['data']['chunks'][0], JSON_PRETTY_PRINT));
        echo "Saved chunk to rag_out.json\n";
        break;
    } else {
        echo "No chunks found. Error: " . ($json['message'] ?? 'None') . "\n";
    }
}
