<?php

namespace App\Http\Controllers;

use App\Repositories\MockPropertyRepository;
use Illuminate\Contracts\View\View;
use Illuminate\Http\Request;

class PropertySearchController extends Controller
{
    public function __invoke(Request $request, MockPropertyRepository $properties): View
    {
        if (! $request->has('property_search')) {
            return view('property-search');
        }

        $search = trim((string) $request->input('property_search'));

        if ($search === '') {
            return view('property-search', [
                'validationMessage' => 'Enter a street address or property ID to search.',
            ]);
        }

        if (strlen($search) > 255) {
            return view('property-search', [
                'validationMessage' => 'Your search must be 255 characters or fewer.',
            ]);
        }

        $property = $properties->find($search);

        $interpretation = null;

        if ($property !== null) {
            $difference = $property['market_value'] - $property['appraised_value'];
            $interpretation = [
                'difference' => $difference,
                'percentage' => $property['market_value'] > 0
                    ? round(($difference / $property['market_value']) * 100, 1)
                    : 0,
            ];
        }

        return view('property-search', [
            'property' => $property,
            'interpretation' => $interpretation,
            'searched' => true,
        ]);
    }
}
