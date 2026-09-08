<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class DokumenHukum extends Model
{
    protected $fillable = [
        'jdih_id',
        'slug',
        'jenis',
        'nomor',
        'tahun',
        'judul',
        'status',
        'tanggal_penetapan',
        'url_detail',
        'pdf_url',
        'peraturan_terkait',
        'keterangan_status',
        'ragflow_document_id',
        'source_hash',
        'sync_status',
        'last_synced_at',
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
    ];

    protected $casts = [
        'tanggal_penetapan' => 'date',
        'tanggal_pengundangan' => 'date',
        'last_synced_at' => 'datetime',
    ];

    public function chatMessages()
    {
        return $this->hasMany(ChatMessage::class);
    }
}