<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('dokumen_hukums', function (Blueprint $table) {
            $table->text('peraturan_terkait')->nullable()->after('pdf_url');
            $table->text('keterangan_status')->nullable()->after('peraturan_terkait');
        });
    }

    public function down(): void
    {
        Schema::table('dokumen_hukums', function (Blueprint $table) {
            $table->dropColumn(['peraturan_terkait', 'keterangan_status']);
        });
    }
};