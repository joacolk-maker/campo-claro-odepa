import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const dataDir = join(process.cwd(), 'public/data');
const manifest = JSON.parse(await readFile(join(dataDir, 'manifest.json'), 'utf8'));
const baselineYears = manifest.years.map((item) => item.year).filter((year) => year < 2026);
const availability = new Map();
const activityCounts = new Map();
const seriesStats = new Map();
const labels = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

for (const year of baselineYears) {
  const snapshot = JSON.parse(await readFile(join(dataDir, `odepa-${year}.json`), 'utf8'));
  snapshot.rows.forEach((row) => {
    const date = snapshot.dates[row[0]]; const month = Number(date.slice(5, 7)); const product = snapshot.products[row[4]];
    const productMonths = availability.get(product) ?? new Map();
    const dates = productMonths.get(month) ?? new Set(); dates.add(date); productMonths.set(month, dates); availability.set(product, productMonths);
    const seriesKey = JSON.stringify([snapshot.subsectors[row[3]], product, snapshot.varieties[row[5]], snapshot.qualities[row[6]], snapshot.units[row[7]]]);
    const productActivity = activityCounts.get(product) ?? Array(12).fill(0); productActivity[month - 1] += 1; activityCounts.set(product, productActivity);
    const current = seriesStats.get(seriesKey) ?? { product, totalVolume: 0, totalValue: 0, months: new Map() };
    const volume = Number(row[8]); const value = Number(row[11]) * volume;
    current.totalVolume += volume; current.totalValue += value;
    const monthStat = current.months.get(month) ?? { volume: 0, value: 0 };
    monthStat.volume += volume; monthStat.value += value; current.months.set(month, monthStat); seriesStats.set(seriesKey, current);
  });
}

const pressure = new Map();
for (const stat of seriesStats.values()) {
  if (!stat.totalVolume || !stat.totalValue) continue;
  const baseline = stat.totalValue / stat.totalVolume;
  for (const [month, monthStat] of stat.months) {
    if (!monthStat.volume) continue;
    const values = pressure.get(stat.product) ?? Array.from({ length: 12 }, () => []);
    values[month - 1].push((monthStat.value / monthStat.volume) / baseline - 1); pressure.set(stat.product, values);
  }
}

const products = {};
for (const [product, months] of availability) {
  const ratios = Array.from({ length: 12 }, (_, index) => {
    const observed = [...(months.get(index + 1) ?? [])].length;
    const possible = baselineYears.reduce((sum, year) => sum + new Date(Date.UTC(year, index + 1, 0)).getUTCDate(), 0);
    return observed / Math.max(possible, 1);
  });
  const activity = activityCounts.get(product) ?? Array(12).fill(0);
  const maximum = Math.max(...activity, 1);
  products[product] = { months: ratios.map((availabilityRatio, index) => {
    // La estacionalidad se apoya en la intensidad de reportes del producto,
    // no en una sola combinación de calidad, unidad o mercado.
    const relative = activity[index] / maximum;
    const category = relative < .15 ? 'Nula' : relative < .4 ? 'Escasa' : relative < .75 ? 'Media' : 'Alta';
    const pressureValues = (pressure.get(product)?.[index] ?? []).sort((a, b) => a - b);
    const pressureValue = pressureValues.length ? pressureValues[Math.floor(pressureValues.length / 2)] : null;
    return { month: index + 1, label: labels[index], availability: Number(availabilityRatio.toFixed(3)), relativeAvailability: Number(relative.toFixed(3)), category, pricePressure: pressureValue === null ? null : Number(pressureValue.toFixed(3)) };
  }) };
}

await writeFile(join(dataDir, 'seasonality.json'), `${JSON.stringify({ schema_version: 1, baseline_years: baselineYears, methodology: 'Disponibilidad observada por días reportados; presión de precio normalizada dentro de cada serie comercial.', products })}\n`);
console.log(`Estacionalidad calculada para ${Object.keys(products).length} productos usando ${baselineYears.length} años completos.`);
