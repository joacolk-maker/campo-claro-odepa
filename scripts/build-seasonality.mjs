import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const dataDir = join(process.cwd(), 'public/data');
const manifest = JSON.parse(await readFile(join(dataDir, 'manifest.json'), 'utf8'));
const baselineYears = manifest.years.map((item) => item.year).filter((year) => year < 2026);

// Una fila por serie exacta. La interfaz suma únicamente las filas que
// corresponden a los filtros elegidos, sin confundir volumen con registros ODEPA.
const dimensionNames = ['regions', 'markets', 'subsectors', 'products', 'varieties', 'qualities', 'units'];
const dimensions = Object.fromEntries(dimensionNames.map((name) => [name, []]));
const indexes = Object.fromEntries(dimensionNames.map((name) => [name, new Map()]));
const dimensionIndex = (name, value) => {
  const index = indexes[name];
  if (!index.has(value)) {
    index.set(value, dimensions[name].length);
    dimensions[name].push(value);
  }
  return index.get(value);
};
const series = new Map();

for (const year of baselineYears) {
  const snapshot = JSON.parse(await readFile(join(dataDir, `odepa-${year}.json`), 'utf8'));
  snapshot.rows.forEach((row) => {
    const month = Number(snapshot.dates[row[0]].slice(5, 7));
    const key = [
      dimensionIndex('regions', snapshot.regions[row[1]]),
      dimensionIndex('markets', snapshot.markets[row[2]]),
      dimensionIndex('subsectors', snapshot.subsectors[row[3]]),
      dimensionIndex('products', snapshot.products[row[4]]),
      dimensionIndex('varieties', snapshot.varieties[row[5]]),
      dimensionIndex('qualities', snapshot.qualities[row[6]]),
      dimensionIndex('units', snapshot.units[row[7]]),
    ];
    const id = key.join(',');
    const current = series.get(id) ?? { key, volumes: Array(12).fill(0) };
    current.volumes[month - 1] += Number(row[8]);
    series.set(id, current);
  });
}

const rows = [...series.values()].map(({ key, volumes }) => [
  ...key,
  volumes.map((value) => Math.round(value / baselineYears.length)),
]);

const output = {
  schema_version: 2,
  baseline_years: baselineYears,
  methodology: 'Promedio mensual histórico del volumen transado informado por ODEPA, calculado por serie comercial exacta.',
  dimensions,
  rows,
};

await writeFile(join(dataDir, 'seasonality-v2.json'), `${JSON.stringify(output)}\n`);
console.log(`Estacionalidad calculada para ${rows.length} series exactas usando ${baselineYears.length} años completos.`);

