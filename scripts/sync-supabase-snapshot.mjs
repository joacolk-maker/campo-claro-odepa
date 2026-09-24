import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const SUPABASE_URL = (process.env.SUPABASE_URL ?? 'https://raeschwvwcejkcaungiv.supabase.co').replace(/\/$/, '');
const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY ?? 'sb_publishable_OIctI2A8DapZ-xeJHO6ACw_rZUMz-Op';
const SOURCE_URL = 'https://datos.odepa.gob.cl/dataset/33f10516-acbe-4446-b633-68244b9b6b26/resource/580beca0-e87e-4dd4-9e8a-0bd92773f4a6/download/precio_mayorista_fruta-hortaliza_2026.csv';
const DATA_YEAR = 2026;
const PAGE_SIZE = 1000;
const CONCURRENCY = 6;
const dataDirectory = join(process.cwd(), 'public/data');

const headers = {
  apikey: SUPABASE_PUBLISHABLE_KEY,
  Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
};

async function exactCount(table) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=id&limit=1`, {
    headers: { ...headers, Prefer: 'count=exact', Range: '0-0' },
  });
  if (!response.ok) throw new Error(`Supabase no pudo contar ${table}: ${response.status} ${await response.text()}`);
  const range = response.headers.get('content-range');
  const count = Number(range?.split('/')[1]);
  if (!Number.isFinite(count)) throw new Error(`Supabase no devolvio el total de ${table}.`);
  return count;
}

async function fetchPage(start, end) {
  const columns = [
    'id', 'fecha', 'id_region', 'region', 'mercado', 'subsector', 'producto',
    'variedad', 'calidad', 'unidad_comercializacion', 'origen', 'volumen',
    'precio_minimo', 'precio_maximo', 'precio_promedio',
  ].join(',');
  const url = `${SUPABASE_URL}/rest/v1/precios_web?select=${columns}&order=id.asc`;
  const response = await fetch(url, { headers: { ...headers, Range: `${start}-${end}` } });
  if (!response.ok) throw new Error(`Supabase fallo en filas ${start}-${end}: ${response.status} ${await response.text()}`);
  return response.json();
}

async function fetchAllRows(total) {
  const pages = [];
  for (let start = 0; start < total; start += PAGE_SIZE) pages.push([start, Math.min(start + PAGE_SIZE - 1, total - 1)]);
  const rows = [];
  for (let index = 0; index < pages.length; index += CONCURRENCY) {
    const batch = pages.slice(index, index + CONCURRENCY);
    const results = await Promise.all(batch.map(([start, end]) => fetchPage(start, end)));
    results.forEach((result) => rows.push(...result));
    console.log(`Supabase: ${Math.min(index + batch.length, pages.length)}/${pages.length} paginas descargadas`);
  }
  return rows;
}

function sortedValues(rows, field) {
  return [...new Set(rows.map((row) => String(row[field] ?? '')))].sort((a, b) => a.localeCompare(b, 'es'));
}

function compactSnapshot(rows, sourceRows) {
  const dates = sortedValues(rows, 'fecha');
  const regions = sortedValues(rows, 'region');
  const markets = sortedValues(rows, 'mercado');
  const subsectors = sortedValues(rows, 'subsector');
  const products = sortedValues(rows, 'producto');
  const varieties = sortedValues(rows, 'variedad');
  const qualities = sortedValues(rows, 'calidad');
  const units = sortedValues(rows, 'unidad_comercializacion');
  const indexes = [dates, regions, markets, subsectors, products, varieties, qualities, units]
    .map((values) => new Map(values.map((value, index) => [value, index])));
  const generatedAt = new Date().toISOString();

  const compactRows = rows.map((row) => [
    indexes[0].get(String(row.fecha ?? '')),
    indexes[1].get(String(row.region ?? '')),
    indexes[2].get(String(row.mercado ?? '')),
    indexes[3].get(String(row.subsector ?? '')),
    indexes[4].get(String(row.producto ?? '')),
    indexes[5].get(String(row.variedad ?? '')),
    indexes[6].get(String(row.calidad ?? '')),
    indexes[7].get(String(row.unidad_comercializacion ?? '')),
    Number(row.volumen ?? 0),
    String(row.precio_minimo ?? ''),
    String(row.precio_maximo ?? ''),
    String(row.precio_promedio ?? ''),
    1,
  ]).sort((a, b) => {
    for (let index = 0; index < 8; index += 1) if (a[index] !== b[index]) return a[index] - b[index];
    return 0;
  });

  const fingerprint = createHash('sha256').update(JSON.stringify(rows)).digest('hex');
  return {
    meta: {
      schema_version: 3,
      source_url: SOURCE_URL,
      source_year: DATA_YEAR,
      snapshot_generated_at: generatedAt,
      source_fetched_at: generatedAt,
      max_data_date: dates.at(-1),
      min_data_date: dates[0],
      source_rows: sourceRows,
      aggregated_rows: compactRows.length,
      source_file_sha256: fingerprint,
    },
    dates, regions, markets, subsectors, products, varieties, qualities, units, rows: compactRows,
  };
}

async function rebuildManifest(updatedSnapshot) {
  const current = JSON.parse(await readFile(join(dataDirectory, 'manifest.json'), 'utf8'));
  const years = [];
  const dimensions = {
    regions: new Set(), markets: new Set(), subsectors: new Set(), products: new Set(),
    varieties: new Set(), qualities: new Set(), units: new Set(),
  };

  for (const entry of current.years) {
    const snapshot = entry.year === DATA_YEAR
      ? updatedSnapshot
      : JSON.parse(await readFile(join(dataDirectory, entry.file), 'utf8'));
    const { meta } = snapshot;
    years.push({
      year: meta.source_year,
      file: entry.file,
      min_data_date: meta.min_data_date,
      max_data_date: meta.max_data_date,
      source_rows: meta.source_rows,
      aggregated_rows: meta.aggregated_rows,
    });
    for (const field of Object.keys(dimensions)) snapshot[field].forEach((value) => dimensions[field].add(value));
  }

  return {
    schema_version: 3,
    snapshot_generated_at: updatedSnapshot.meta.snapshot_generated_at,
    min_data_date: years[0].min_data_date,
    max_data_date: years.at(-1).max_data_date,
    source_rows: years.reduce((sum, item) => sum + item.source_rows, 0),
    aggregated_rows: years.reduce((sum, item) => sum + item.aggregated_rows, 0),
    dimension_counts: Object.fromEntries(Object.entries(dimensions).map(([field, values]) => [field, values.size])),
    years,
  };
}

const viewRows = await exactCount('precios_web');
// La clave publicable solo puede leer la vista autorizada. Usamos ese total como
// universo público sin abrir precios_raw ni incorporar la clave de servicio.
const sourceRows = viewRows;
console.log(`Supabase: ${viewRows} filas publicas`);
const rows = await fetchAllRows(viewRows);
if (rows.length !== viewRows) throw new Error(`Se esperaban ${viewRows} filas de precios_web y llegaron ${rows.length}.`);

const snapshot = compactSnapshot(rows, sourceRows);
const manifest = await rebuildManifest(snapshot);
await writeFile(join(dataDirectory, `odepa-${DATA_YEAR}.json`), `${JSON.stringify(snapshot)}\n`);
await writeFile(join(dataDirectory, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);

console.log(JSON.stringify({
  year: DATA_YEAR,
  source_rows: snapshot.meta.source_rows,
  aggregated_rows: snapshot.meta.aggregated_rows,
  min_data_date: snapshot.meta.min_data_date,
  max_data_date: snapshot.meta.max_data_date,
}));
