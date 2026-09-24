import { readFile } from 'node:fs/promises';

const dataDirectory = new URL('../public/data/', import.meta.url);
const manifest = JSON.parse(await readFile(new URL('manifest.json', dataDirectory), 'utf8'));

if (manifest.schema_version !== 3) {
  throw new Error('The historical manifest has an incompatible schema version.');
}
if (!manifest.snapshot_generated_at || Number.isNaN(Date.parse(manifest.snapshot_generated_at))) {
  throw new Error('The historical manifest has no valid generation timestamp.');
}
if (!Array.isArray(manifest.years) || manifest.years.length !== 11) {
  throw new Error('The historical manifest must cover 2016 through 2026.');
}

let aggregatedRows = 0;
for (const entry of manifest.years) {
  const snapshot = JSON.parse(await readFile(new URL(entry.file, dataDirectory), 'utf8'));
  const meta = snapshot.meta ?? {};
  if (meta.schema_version !== 3 || meta.source_year !== entry.year) {
    throw new Error(`The ${entry.year} snapshot has an incompatible schema.`);
  }
  if (!Array.isArray(snapshot.rows) || snapshot.rows.length === 0) {
    throw new Error(`The ${entry.year} snapshot contains no public rows.`);
  }
  if (meta.aggregated_rows !== snapshot.rows.length || entry.aggregated_rows !== snapshot.rows.length) {
    throw new Error(`The ${entry.year} snapshot row count does not match its metadata.`);
  }
  if (snapshot.rows.some((row) => !Array.isArray(row) || row.length !== 13)) {
    throw new Error(`The ${entry.year} snapshot contains an incompatible compact row.`);
  }
  if (!snapshot.dates.every((date) => date.startsWith(`${entry.year}-`))) {
    throw new Error(`The ${entry.year} snapshot contains dates from another year.`);
  }
  aggregatedRows += snapshot.rows.length;
}
if (aggregatedRows !== manifest.aggregated_rows) {
  throw new Error('The historical row count does not match the manifest.');
}

console.log(JSON.stringify({
  years: manifest.years.length,
  rows: aggregatedRows,
  snapshot_generated_at: manifest.snapshot_generated_at,
  min_data_date: manifest.min_data_date,
  max_data_date: manifest.max_data_date,
}));
