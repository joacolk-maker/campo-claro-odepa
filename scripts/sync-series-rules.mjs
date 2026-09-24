import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const supabaseUrl = process.env.SUPABASE_URL?.replace(/\/$/, '');
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const table = process.env.SUPABASE_RULES_TABLE ?? 'campo_claro_series_rules';
const outputPath = join(process.cwd(), 'public/data/series-rules.json');
const select = 'subsector,product,variety,quality,commercial_unit,observations,box,updated_at';

if (!supabaseUrl || !serviceKey) {
  throw new Error('Faltan SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY. No se exportan reglas sin conexión explícita.');
}

const rows = [];
for (let offset = 0; ; offset += 1000) {
  const response = await fetch(`${supabaseUrl}/rest/v1/${table}?select=${select}&order=id&limit=1000&offset=${offset}`, {
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
  });
  if (!response.ok) throw new Error(`Supabase respondió ${response.status}: ${await response.text()}`);
  const page = await response.json();
  rows.push(...page);
  if (page.length < 1000) break;
}

const keyOf = (row) => JSON.stringify([row.subsector, row.product, row.variety, row.quality, row.commercial_unit]);
const allowed = rows.filter((row) => Number(row.box) === 1).map(keyOf);
const rules = {
  schema_version: 1,
  generated_at: new Date().toISOString(),
  source: 'supabase.campo_claro_series_rules',
  matching_dimensions: ['subsector', 'product', 'variety', 'quality', 'commercial_unit'],
  total_rules: rows.length,
  allowed_rules: allowed.length,
  allowed_series: allowed,
};

// Verifica que una regla aprobada no tenga un typo que la deje sin datos públicos.
const manifest = JSON.parse(await readFile(join(process.cwd(), 'public/data/manifest.json'), 'utf8'));
const available = new Set();
for (const year of manifest.years) {
  const snapshot = JSON.parse(await readFile(join(process.cwd(), 'public/data', year.file), 'utf8'));
  for (const row of snapshot.rows) available.add(JSON.stringify([
    snapshot.subsectors[row[3]], snapshot.products[row[4]], snapshot.varieties[row[5]], snapshot.qualities[row[6]], snapshot.units[row[7]],
  ]));
}
const unmatched = allowed.filter((key) => !available.has(key));
if (unmatched.length) {
  throw new Error(`${unmatched.length} reglas box=1 no coinciden con ninguna serie ODEPA publicada. Revisa normalización y nombres de la planilla.`);
}

await writeFile(outputPath, `${JSON.stringify(rules)}\n`);
console.log(`Reglas Supabase exportadas: ${allowed.length} aprobadas de ${rows.length}.`);
