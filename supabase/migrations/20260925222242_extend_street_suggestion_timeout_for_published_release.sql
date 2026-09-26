-- Keep the street-first typeahead responsive after the active and prior releases
-- both contribute search documents to the trigram index. The route's 10-second
-- budget still bounds the request; the function formerly canceled at 2 seconds.
alter function public.suggest_property_parcels(text, integer, boolean)
  set statement_timeout = '6s';
