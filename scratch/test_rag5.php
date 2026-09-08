<?php
require __DIR__.'/../vendor/autoload.php';
$app = require_once __DIR__.'/../bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

$service = app(\App\Services\RagflowService::class);
// Get any document
$doc = \App\Models\DokumenHukum::whereNotNull('ragflow_document_id')->first();
if (!$doc) die("No doc\n");
echo "Doc: " . $doc->ragflow_document_id . "\n";
// retrieve chunks directly
$reflection = new \ReflectionClass($service);
$method = $reflection->getMethod('retrieveChunks');
$method->setAccessible(true);
$chunks = $method->invoke($service, $doc->ragflow_document_id, 'pasal');
print_r(array_slice($chunks, 0, 1));
