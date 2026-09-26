const object = value => typeof value === 'object' && value !== null && !Array.isArray(value);
const date = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));

export function validatePublishedNeighborhood(value, propertyId = '736302') {
  const failures = [];
  if (!object(value)) return { failures: ['response must be an object'] };
  if (value.status !== 'ok') failures.push(`status must be ok (received ${String(value.status)})`);
  if (typeof value.source_id !== 'string' || !/^[0-9a-f-]{36}$/i.test(value.source_id)) failures.push('source_id must be a UUID');
  if (value.neighborhood !== 'T2450') failures.push(`property ${propertyId} must resolve to neighborhood T2450`);
  if (!Array.isArray(value.agent_assignments)) failures.push('required field agent_assignments must be an array');
  if (!Array.isArray(value.annual_periods) || value.annual_periods.length === 0) failures.push('annual_periods must contain at least one usable period');
  else for (const [index, period] of value.annual_periods.entries()) {
    if (!object(period) || !object(period.release) || !Number.isInteger(period.release.tax_year) ||
      !['preliminary', 'certified'].includes(period.release.roll_stage) || !date(period.release.export_date) ||
      !Array.isArray(period.homes) || !Array.isArray(period.caps)) failures.push(`annual_periods[${index}] is not structurally usable`);
  }
  if (!Array.isArray(value.homes) || value.homes.length === 0 || value.homes.some(home => !object(home) || typeof home.property_id !== 'string'))
    failures.push('eligible-property result must contain structurally valid homes');
  if (!object(value.population) || !Number.isInteger(value.population.candidate_count) || value.population.candidate_count < 0 ||
    !Array.isArray(value.population.excluded) || Array.isArray(value.homes) && value.population.candidate_count < value.homes.length)
    failures.push('population eligibility metadata is structurally invalid');
  return { failures, eligiblePropertyCount: Array.isArray(value.homes) ? value.homes.length : null };
}
