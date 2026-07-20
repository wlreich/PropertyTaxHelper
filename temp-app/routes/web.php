<?php

use App\Http\Controllers\PropertySearchController;
use Illuminate\Support\Facades\Route;

Route::get('/', PropertySearchController::class)->name('property-search');
