<?php
require __DIR__.'/../vendor/autoload.php';
$app = require_once __DIR__.'/../bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

$service = app(\App\Services\RagflowService::class);
$reflection = new \ReflectionClass($service);
$method = $reflection->getMethod('retrieveChunks');
$method->setAccessible(true);

$docs = \App\Models\DokumenHukum::whereNotNull('ragflow_document_id')->take(5)->get();
foreach ($docs as $doc) {
    echo "Doc: " . $doc->ragflow_document_id . "\n";
    $chunks = $method->invoke($service, $doc->ragflow_document_id, 'pasal');
    if (!empty($chunks)) {
        print_r($chunks[0]);
        break;
    }
}
