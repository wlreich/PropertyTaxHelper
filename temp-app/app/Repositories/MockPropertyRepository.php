<?php

namespace App\Repositories;

class MockPropertyRepository
{
    /**
     * Find a demonstration property by exact PID or normalized address.
     *
     * @return array<string, int|string>|null
     */
    public function find(string $search): ?array
    {
        $search = trim($search);

        foreach (config('mock_properties.records', []) as $property) {
            if ($search === $property['pid']) {
                return $property;
            }

            if (strtolower($search) === strtolower($property['address'])) {
                return $property;
            }
        }

        return null;
    }
}
