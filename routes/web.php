<?php

use App\Http\Controllers\DocumentController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Beranda → langsung ke daftar dokumen JDIH
|--------------------------------------------------------------------------
*/
Route::get('/', fn () => redirect()->route('documents.index'))->name('home');

/*
|--------------------------------------------------------------------------
| JDIH Documents (publik)
|--------------------------------------------------------------------------
*/
Route::get('/documents', [DocumentController::class, 'index'])->name('documents.index');
Route::get('/documents/{dokumenHukum}', [DocumentController::class, 'show'])->name('documents.show');
Route::get('/documents/{dokumenHukum}/pdf', [DocumentController::class, 'pdf'])->name('documents.pdf');
Route::get('/documents/{dokumenHukum}/suggestions', [DocumentController::class, 'suggestions'])->name('documents.suggestions');
Route::post('/documents/{dokumenHukum}/chat', [DocumentController::class, 'chat'])->name('documents.chat');
Route::get('/documents/{dokumenHukum}/history', [DocumentController::class, 'history'])->name('documents.history');