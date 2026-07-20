<?php

namespace Tests\Feature;

use Tests\TestCase;

class PropertySearchTest extends TestCase
{
    public function test_landing_page_displays_the_property_search_experience(): void
    {
        $response = $this->get('/');

        $response
            ->assertOk()
            ->assertSee('Understand your property appraisal')
            ->assertSee('Demonstration data only')
            ->assertSee('Street address or property ID');
    }

    public function test_recognized_address_displays_property_summary(): void
    {
        $response = $this->get('/?property_search=123%20Sample%20Oak%20Drive%2C%20Austin%2C%20TX');

        $response
            ->assertOk()
            ->assertSee('123 Sample Oak Drive, Austin, TX')
            ->assertSee('Avery Sample')
            ->assertSee('$485,000')
            ->assertSee('$461,500')
            ->assertSee('Demonstration appraisal fixture');
    }

    public function test_recognized_pid_displays_property_summary(): void
    {
        $response = $this->get('/?property_search=100002');

        $response
            ->assertOk()
            ->assertSee('456 Example Ridge Lane, Austin, TX')
            ->assertSee('Property ID')
            ->assertSee('100002')
            ->assertSee('$612,000');
    }

    public function test_address_search_ignores_case_and_surrounding_whitespace(): void
    {
        $response = $this->get('/?property_search=%20%20%20789%20demo%20creek%20court%2C%20austin%2C%20tx%20%20');

        $response
            ->assertOk()
            ->assertSee('789 Demo Creek Court, Austin, TX')
            ->assertSee('Morgan Demo');
    }

    public function test_empty_search_displays_validation_message(): void
    {
        $response = $this->get('/?property_search=');

        $response
            ->assertRedirect()
            ->assertSessionHasErrors([
                'property_search' => 'Enter a street address or property ID to search.',
            ]);

        $this->followRedirects($response)
            ->assertSee('Enter a street address or property ID to search.');
    }

    public function test_unmatched_search_displays_helpful_not_found_message(): void
    {
        $response = $this->get('/?property_search=999999');

        $response
            ->assertOk()
            ->assertSee('Property not found')
            ->assertSee('Check the spelling')
            ->assertSee('100001');
    }
}
