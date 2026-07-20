<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <meta name="description" content="Search fictional demonstration property appraisal records by address or property ID.">
        <title>Property Record Guide</title>

        @if (file_exists(public_path('build/manifest.json')) || file_exists(public_path('hot')))
            @vite('resources/css/app.css')
        @else
            <style>{!! file_get_contents(resource_path('css/app.css')) !!}</style>
        @endif
    </head>
    <body>
        <header class="site-header">
            <a class="brand" href="{{ route('property-search') }}" aria-label="Property Record Guide home">
                <span class="brand-mark" aria-hidden="true">
                    <svg viewBox="0 0 32 32" role="img">
                        <path d="M4.5 14.5 16 5l11.5 9.5v12a1.5 1.5 0 0 1-1.5 1.5H6a1.5 1.5 0 0 1-1.5-1.5v-12Z"/>
                        <path d="M11 28V17h10v11M2 16 16 4l14 12"/>
                    </svg>
                </span>
                <span>Property Record Guide</span>
            </a>
            <span class="prototype-label">Public-record prototype</span>
        </header>

        <main>
            <section class="hero" aria-labelledby="page-title">
                <div class="hero-copy">
                    <p class="eyebrow">Your appraisal, in plain language</p>
                    <h1 id="page-title">Understand your property appraisal</h1>
                    <p class="intro">
                        Search public appraisal information by address or property ID. Review the values and property
                        details used in your appraisal record, with clear source dates and plain-language explanations.
                    </p>
                </div>

                <div class="search-card">
                    <div class="demo-notice" role="note">
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                            <path d="M12 8v5m0 3.5v.1M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"/>
                        </svg>
                        <div>
                            <strong>Demonstration data only</strong>
                            <span>Search one of three fictional sample records.</span>
                        </div>
                    </div>

                    <form action="{{ route('property-search') }}" method="GET" novalidate>
                        <label for="property_search">Street address or property ID</label>
                        <div class="search-controls">
                            <input
                                id="property_search"
                                name="property_search"
                                type="search"
                                value="{{ old('property_search', request('property_search')) }}"
                                placeholder="Try 123 Sample Oak Drive or 100001"
                                autocomplete="street-address"
                                aria-describedby="search-hint @error('property_search') search-error @enderror"
                                @error('property_search') aria-invalid="true" @enderror
                            >
                            <button type="submit">
                                <svg viewBox="0 0 24 24" aria-hidden="true">
                                    <circle cx="10.5" cy="10.5" r="6.5"/>
                                    <path d="m15.5 15.5 5 5"/>
                                </svg>
                                Search
                            </button>
                        </div>
                        <p id="search-hint" class="field-hint">Enter a complete sample address or exact six-digit PID.</p>

                        @error('property_search')
                            <p id="search-error" class="message message-error" role="alert">
                                <span aria-hidden="true">!</span>
                                {{ $message }}
                            </p>
                        @enderror
                    </form>
                </div>
            </section>

            @isset($searched)
                @if ($property)
                    @php
                        $currency = fn (int $value): string => '$'.number_format($value);
                    @endphp
                    <section class="results" aria-labelledby="result-title" aria-live="polite">
                        <div class="result-heading">
                            <div>
                                <p class="eyebrow">Demonstration property found</p>
                                <h2 id="result-title">{{ $property['address'] }}</h2>
                                <p class="property-meta">Property ID <strong>{{ $property['pid'] }}</strong> <span aria-hidden="true">•</span> Tax year <strong>{{ $property['tax_year'] }}</strong></p>
                            </div>
                            <a class="search-again" href="#property_search">Search another property</a>
                        </div>

                        <div class="information-key" aria-label="Information type key">
                            <span><i class="key-fact"></i>Source fact</span>
                            <span><i class="key-calculation"></i>Calculated context</span>
                            <span><i class="key-explanation"></i>Explanation</span>
                        </div>

                        <div class="result-layout">
                            <article class="facts-panel">
                                <div class="panel-label label-fact">Source facts</div>
                                <h3>Appraisal record summary</h3>
                                <p class="panel-intro">Values shown exactly as stored in this fictional sample record.</p>

                                <dl class="facts-grid">
                                    <div class="fact fact-wide">
                                        <dt>Owner name</dt>
                                        <dd>{{ $property['owner'] }} <small>Fictional</small></dd>
                                    </div>
                                    <div class="fact">
                                        <dt>Market value</dt>
                                        <dd>{{ $currency($property['market_value']) }}</dd>
                                    </div>
                                    <div class="fact">
                                        <dt>Appraised value</dt>
                                        <dd>{{ $currency($property['appraised_value']) }}</dd>
                                    </div>
                                    <div class="fact">
                                        <dt>Land value</dt>
                                        <dd>{{ $currency($property['land_value']) }}</dd>
                                    </div>
                                    <div class="fact">
                                        <dt>Improvement value</dt>
                                        <dd>{{ $currency($property['improvement_value']) }}</dd>
                                    </div>
                                </dl>

                                <dl class="source-details">
                                    <div>
                                        <dt>Data source</dt>
                                        <dd>{{ $property['source'] }}</dd>
                                    </div>
                                    <div>
                                        <dt>Source date</dt>
                                        <dd>{{ \Illuminate\Support\Carbon::parse($property['source_date'])->format('F j, Y') }}</dd>
                                    </div>
                                </dl>
                            </article>

                            <aside class="context-column" aria-label="Property value context">
                                <div class="context-card calculation-card">
                                    <div class="panel-label label-calculation">Calculated context</div>
                                    <h3>How the values compare</h3>
                                    <p>
                                        The sample appraised value is
                                        <strong>{{ $currency(abs($interpretation['difference'])) }}</strong>
                                        ({{ $interpretation['percentage'] }}%)
                                        {{ $interpretation['difference'] >= 0 ? 'below' : 'above' }} the market value.
                                    </p>
                                    <small>This comparison is calculated from the source facts shown here.</small>
                                </div>

                                <div class="context-card explanation-card">
                                    <div class="panel-label label-explanation">Explanation</div>
                                    <h3>What do these values mean?</h3>
                                    <p><strong>Land value</strong> is the appraised value assigned to the lot itself.</p>
                                    <p><strong>Improvement value</strong> covers structures and other additions to the land.</p>
                                    <p><strong>Appraised value</strong> may differ from market value because appraisal rules or limits can apply.</p>
                                </div>
                            </aside>
                        </div>
                    </section>
                @else
                    <section class="not-found" aria-live="polite">
                        <div class="not-found-icon" aria-hidden="true">?</div>
                        <div>
                            <h2>Property not found</h2>
                            <p>
                                We could not find a demonstration property matching
                                <strong>“{{ request('property_search') }}”</strong>. Check the spelling or try sample PID
                                <strong>100001</strong>, <strong>100002</strong>, or <strong>100003</strong>.
                            </p>
                        </div>
                    </section>
                @endif
            @endisset

            <section class="disclaimer" aria-labelledby="disclaimer-title">
                <div aria-hidden="true">i</div>
                <p>
                    <strong id="disclaimer-title">About this demonstration</strong>
                    This experience uses fictional sample data and should not be used for a property-tax protest or
                    any other official purpose. No real homeowner or appraisal records are included.
                </p>
            </section>
        </main>

        <footer>
            <span>Property Record Guide</span>
            <span>Designed to make public appraisal information easier to understand.</span>
        </footer>
    </body>
</html>
