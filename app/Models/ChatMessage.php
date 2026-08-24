<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ChatMessage extends Model
{
    use HasFactory;

    protected $fillable = [
        'dokumen_hukum_id',
        'role',
        'message',
        'references',
    ];

    protected $casts = [
        'references' => 'array',
    ];

    public function dokumenHukum()
    {
        return $this->belongsTo(DokumenHukum::class);
    }
}