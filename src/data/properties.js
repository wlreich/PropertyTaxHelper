export const properties = [
  {
    id: "01-0203-0412-0000",
    address: "1601 Elm Street",
    city: "Austin",
    state: "TX",
    zip: "78703",
    county: "Travis County",
    owner: "Jordan and Avery Taylor",
    marketValue: 684500,
    assessedValue: 620000,
    annualTax: 13244,
    taxRate: 2.1361,
    year: 2026,
    valueChange: 8.2,
    type: "Single family",
  },
  {
    id: "02-4401-0810-0000",
    address: "4207 Shoal Creek Boulevard",
    city: "Austin",
    state: "TX",
    zip: "78756",
    county: "Travis County",
    owner: "Morgan Lee",
    marketValue: 792300,
    assessedValue: 718000,
    annualTax: 15338,
    taxRate: 2.1361,
    year: 2026,
    valueChange: 11.4,
    type: "Single family",
  },
  {
    id: "04-0119-1204-0000",
    address: "905 East 5th Street, Unit 214",
    city: "Austin",
    state: "TX",
    zip: "78702",
    county: "Travis County",
    owner: "Casey Rodriguez",
    marketValue: 438000,
    assessedValue: 438000,
    annualTax: 9356,
    taxRate: 2.1361,
    year: 2026,
    valueChange: -2.1,
    type: "Condominium",
  },
  {
    id: "R384910",
    address: "117 Oak Meadow Drive",
    city: "Round Rock",
    state: "TX",
    zip: "78664",
    county: "Williamson County",
    owner: "Sam Patel",
    marketValue: 412700,
    assessedValue: 385000,
    annualTax: 8255,
    taxRate: 2.1442,
    year: 2026,
    valueChange: 4.7,
    type: "Single family",
  },
];

const searchableText = (property) =>
  [
    property.address,
    property.city,
    property.state,
    property.zip,
    property.county,
    property.owner,
    property.id,
  ]
    .join(" ")
    .toLocaleLowerCase();

export function searchProperties(query) {
  const normalizedQuery = query.trim().toLocaleLowerCase();

  if (!normalizedQuery) {
    return [];
  }

  const terms = normalizedQuery.split(/\s+/);
  return properties.filter((property) => {
    const text = searchableText(property);
    return terms.every((term) => text.includes(term));
  });
}
