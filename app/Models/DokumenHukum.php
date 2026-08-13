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
    ];

    protected $casts = [
        'tanggal_penetapan' => 'date',
        'last_synced_at' => 'datetime',
    ];
}