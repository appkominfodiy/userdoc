<?php

use App\Http\Controllers\DocumentController;
use App\Http\Controllers\ProfileController;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;

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
Route::post('/documents/{dokumenHukum}/chat', [DocumentController::class, 'chat'])->name('documents.chat');

/*
|--------------------------------------------------------------------------
| Bawaan starter kit
|--------------------------------------------------------------------------
*/
Route::get('/dashboard', function () {
    return Inertia::render('Dashboard');
})->middleware(['auth', 'verified'])->name('dashboard');

Route::middleware('auth')->group(function () {
    Route::get('/profile', [ProfileController::class, 'edit'])->name('profile.edit');
    Route::patch('/profile', [ProfileController::class, 'update'])->name('profile.update');
    Route::delete('/profile', [ProfileController::class, 'destroy'])->name('profile.destroy');
});

require __DIR__.'/auth.php';