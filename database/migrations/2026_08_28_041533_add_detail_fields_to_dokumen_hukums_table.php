<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('dokumen_hukums', function (Blueprint $table) {
            $table->date('tanggal_pengundangan')->nullable();
            $table->string('penandatangan')->nullable();
            $table->string('pemrakarsa')->nullable();
            $table->string('sumber')->nullable();
            $table->string('teu_badan')->nullable();
            $table->string('tempat_penetapan')->nullable();
            $table->string('lokasi')->nullable();
            $table->string('bahasa')->nullable();
            $table->string('bidang_hukum')->nullable();
            $table->string('urusan_pemerintahan')->nullable();
            $table->string('subjek')->nullable();
            $table->text('dokumen_terkait')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('dokumen_hukums', function (Blueprint $table) {
            $table->dropColumn([
                'tanggal_pengundangan',
                'penandatangan',
                'pemrakarsa',
                'sumber',
                'teu_badan',
                'tempat_penetapan',
                'lokasi',
                'bahasa',
                'bidang_hukum',
                'urusan_pemerintahan',
                'subjek',
                'dokumen_terkait',
            ]);
        });
    }
};
