#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';

export async function checkMigrationParity(historyText, root = process.cwd()) {
  const manifest = JSON.parse(await readFile(resolve(root, 'tools/release-contract/required-migrations.json'), 'utf8'));
  const applied = new Set(historyText.split(/\r?\n/).map(line => line.trim()).filter(Boolean));
  const failures = [];
  const evidence = [];
  for (const contract of manifest.contracts) {
    const migrationPath = resolve(root, contract.file);
    let sql;
    try { sql = await readFile(migrationPath); }
    catch { failures.push(`missing migration file ${contract.file} required by ${contract.name}`); continue; }
    const filenameVersion = basename(contract.file).split('_', 1)[0];
    if (filenameVersion !== contract.version) failures.push(`version drift for ${contract.name}: manifest requires ${contract.version}, but ${contract.file} is version ${filenameVersion}`);
    if (!applied.has(contract.version)) {
      const legacy = contract.supersedesRepositoryVersion;
      failures.push(applied.has(legacy)
        ? `version drift for ${contract.name}: database records legacy repository version ${legacy}; expected reconciled live version ${contract.version}. Repair migration history after verifying the SQL/function, without re-running the DDL.`
        : `missing migration ${contract.version} (${contract.file}) required by ${contract.name}`);
    }
    evidence.push(`${contract.version} ${createHash('sha256').update(sql).digest('hex')} ${contract.name}`);
  }
  return { failures, evidence };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const historyFile = process.argv[2];
  if (!historyFile) { console.error('usage: check-migration-parity.mjs <applied-version-file>'); process.exit(2); }
  const result = await checkMigrationParity(await readFile(historyFile, 'utf8'));
  for (const line of result.evidence) console.log(`verified repository migration: ${line}`);
  if (result.failures.length) {
    for (const failure of result.failures) console.error(`MIGRATION PARITY FAILURE: ${failure}`);
    process.exit(1);
  }
  console.log('Migration parity gate passed.');
}
