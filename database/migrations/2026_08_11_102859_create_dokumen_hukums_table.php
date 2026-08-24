<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('dokumen_hukums', function (Blueprint $table) {
            $table->id();

            // Identitas dari API JDIH DIY asli
            $table->unsignedBigInteger('jdih_id')->unique(); // field "id" dari API JDIH
            $table->string('slug')->nullable();
            $table->string('jenis'); // PERGUB, PERDA, SK, dll (dari jenis_peraturan)
            $table->string('nomor'); // dari nomor_peraturan
            $table->unsignedSmallInteger('tahun'); // dari tahun
            $table->string('judul'); // dari judul_peraturan
            $table->string('status')->default('berlaku'); // berlaku / dicabut / diubah
            $table->date('tanggal_penetapan')->nullable(); // dari tanggal_pengundangan
            $table->string('url_detail')->nullable(); // link ke halaman detail JDIH
            $table->string('pdf_url')->nullable(); // dari file_peraturan

            // Tracking sinkronisasi ke RAGFlow
            $table->string('ragflow_document_id')->nullable(); // ID dokumen setelah diupload ke RAGFlow
            $table->string('source_hash')->nullable(); // hash konten PDF, buat deteksi perubahan
            $table->enum('sync_status', ['pending', 'uploaded', 'parsed', 'failed'])->default('pending');
            $table->timestamp('last_synced_at')->nullable();

            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('dokumen_hukums');
    }
};