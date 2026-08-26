'use client';

import { useEffect, useMemo, useState } from 'react';

type PriceRow = {
  market: string; shortMarket: string; variety: string; quality: string; origin: string;
  unit: string; volume: number; minimum: number; maximum: number; average: number;
};

type ApiPrice = {
  fecha: string; mercado: string; variedad_tipo: string; calidad: string; origen: string;
  unidad_comercializacion: string; volumen: number; precio_minimo: number | string;
  precio_maximo: number | string; precio_promedio: number | string;
};

const apiBase = process.env.NEXT_PUBLIC_API_URL;

const latestPapa: PriceRow[] = [
  { market: 'Mercado Mayorista Lo Valledor de Santiago', shortMarket: 'Lo Valledor', variety: 'Rosi', quality: '1a (cosecha)', origin: 'Región del Maule', unit: '$/saco 25 kilos', volume: 2300, minimum: 13000, maximum: 14000, average: 13521.7391 },
  { market: 'Terminal La Palmera de La Serena', shortMarket: 'La Palmera', variety: 'Rosi', quality: '1a (cosecha)', origin: 'Región del Maule', unit: '$/saco 25 kilos', volume: 2500, minimum: 17000, maximum: 18000, average: 17500 },
  { market: 'Vega Central Mapocho de Santiago', shortMarket: 'Vega Central', variety: 'Rosara', quality: '1a (cosecha)', origin: 'Región del Maule', unit: '$/saco 25 kilos', volume: 1060, minimum: 13000, maximum: 14000, average: 13500 },
  { market: 'Femacal de La Calera', shortMarket: 'Femacal', variety: 'Asterix', quality: '1a (guarda)', origin: "Región de O'Higgins", unit: '$/saco 25 kilos', volume: 380, minimum: 13000, maximum: 14000, average: 13500 },
  { market: 'Macroferia Regional de Talca', shortMarket: 'Macroferia Talca', variety: 'Rosara', quality: '1a (guarda)', origin: 'Región del Maule', unit: '$/saco 25 kilos', volume: 2000, minimum: 11000, maximum: 11000, average: 11000 },
  { market: 'Vega Modelo de Temuco', shortMarket: 'Vega Temuco', variety: 'Rosi', quality: '1a (guarda)', origin: 'Provincia de Cautín', unit: '$/saco 25 kilos', volume: 500, minimum: 11000, maximum: 11000, average: 11000 },
  { market: 'Terminal Hortofrutícola Agro Chillán', shortMarket: 'Agro Chillán', variety: 'Asterix', quality: '1a (cosecha)', origin: 'Región de La Araucanía', unit: '$/saco 25 kilos', volume: 100, minimum: 13000, maximum: 13000, average: 13000 },
];

const money = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 });
const number = new Intl.NumberFormat('es-CL');

export default function Home() {
  const [product, setProduct] = useState('Papa');
  const [products, setProducts] = useState(['Papa']);
  const [apiRows, setApiRows] = useState<PriceRow[] | null>(null);
  const [observationDate, setObservationDate] = useState('21 ago 2026');
  const [market, setMarket] = useState('Todos los mercados');
  const sourceRows = apiRows ?? latestPapa;
  const filteredRows = useMemo(() => market === 'Todos los mercados' ? sourceRows : sourceRows.filter((row) => row.market === market), [market, sourceRows]);
  const average = filteredRows.reduce((sum, row) => sum + row.average, 0) / filteredRows.length;
  const low = Math.min(...filteredRows.map((row) => row.average));
  const high = Math.max(...filteredRows.map((row) => row.average));
  const volume = filteredRows.reduce((sum, row) => sum + row.volume, 0);
  const highRow = filteredRows.find((row) => row.average === high);
  const lowRow = filteredRows.find((row) => row.average === low);

  useEffect(() => {
    if (!apiBase) return;
    fetch(`${apiBase}/api/products`)
      .then(async (response) => { if (!response.ok) throw new Error('API no disponible'); return await response.json() as string[]; })
      .then(setProducts)
      .catch(() => setProducts(['Papa']));
  }, []);

  useEffect(() => {
    if (!apiBase) return;
    fetch(`${apiBase}/api/prices?product=${encodeURIComponent(product)}&limit=1000`)
      .then(async (response) => { if (!response.ok) throw new Error('API no disponible'); return await response.json() as ApiPrice[]; })
      .then((data: ApiPrice[]) => {
        if (!data.length) return;
        const latestDate = data[0].fecha;
        const latest = data.filter((item) => item.fecha === latestDate);
        const units = latest.reduce<Record<string, number>>((acc, item) => ({ ...acc, [item.unidad_comercializacion]: (acc[item.unidad_comercializacion] || 0) + 1 }), {});
        const unit = Object.entries(units).sort((a, b) => b[1] - a[1])[0][0];
        setApiRows(latest.filter((item) => item.unidad_comercializacion === unit).map((item) => ({ market: item.mercado, shortMarket: item.mercado.replace('Mercado Mayorista ', '').replace(' de Santiago', '').replace('Terminal Hortofrutícola ', ''), variety: item.variedad_tipo, quality: item.calidad, origin: item.origen, unit: item.unidad_comercializacion, volume: item.volumen, minimum: Number(item.precio_minimo), maximum: Number(item.precio_maximo), average: Number(item.precio_promedio) })));
        setObservationDate(new Intl.DateTimeFormat('es-CL', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'America/Santiago' }).format(new Date(`${latestDate}T12:00:00-04:00`)));
      })
      .catch(() => setApiRows(null));
  }, [product]);

  return (
    <main>
      <header className="topbar">
        <a className="brand" href="#inicio" aria-label="Campo Claro, inicio"><span className="brand-mark" aria-hidden="true"><i /></span><span>Campo Claro</span></a>
        <nav aria-label="Navegación principal"><a className="active" href="#precios">Precios</a><a href="#mercados">Mercados</a><a href="#datos">Datos</a></nav>
        <span className="official-badge"><i /> Fuente oficial ODEPA</span>
      </header>

      <section className="hero" id="inicio">
        <div><p className="eyebrow">Inteligencia mayorista · Chile</p><h1>Precios del campo,<br /><em>sin ruido.</em></h1><p className="hero-copy">Consulta el historial oficial de frutas y hortalizas por producto, mercado y origen. La unidad publicada por ODEPA se conserva intacta.</p></div>
        <div className="freshness-card" aria-label="Estado de actualización"><span className="pulse" /><div><strong>{apiRows ? 'API conectada' : 'Vista con datos ODEPA'}</strong><small>Último registro: {observationDate}</small></div><span className="freshness-time">09:00 CLT</span></div>
      </section>

      <section className="dashboard" id="precios">
        <div className="filters" aria-label="Filtros de precios">
          <label>Producto<select value={product} onChange={(event) => { setProduct(event.target.value); setMarket('Todos los mercados'); }}>{products.map((item) => <option key={item}>{item}</option>)}</select></label>
          <label>Mercado<select value={market} onChange={(event) => setMarket(event.target.value)}><option>Todos los mercados</option>{Array.from(new Set(sourceRows.map((row) => row.market))).map((item) => <option key={item}>{item}</option>)}</select></label>
          <label>Periodo<select defaultValue="Último dato disponible"><option>Último dato disponible</option></select></label>
        </div>

        <div className="section-heading"><div><span className="produce-dot" /><h2>{product}</h2><span className="unit-pill">{filteredRows[0]?.unit ?? 'Unidad ODEPA'}</span></div><p>Último dato · {observationDate}</p></div>
        <div className="metrics">
          <article className="metric featured"><span>Precio promedio</span><strong>{money.format(average || 0)}</strong><small>Promedio de {filteredRows.length} observaciones</small></article>
          <article className="metric"><span>Mínimo observado</span><strong>{money.format(low || 0)}</strong><small>Por unidad original</small></article>
          <article className="metric"><span>Máximo observado</span><strong>{money.format(high || 0)}</strong><small>Por unidad original</small></article>
          <article className="metric"><span>Volumen informado</span><strong>{number.format(volume)}</strong><small>Unidades de comercialización</small></article>
        </div>

        <div className="content-grid" id="mercados">
          <article className="panel comparison"><div className="panel-title"><div><p>Comparación por mercado</p><h3>Precio promedio observado</h3></div><span>CLP</span></div><div className="bars">
            {[...filteredRows].sort((a, b) => b.average - a.average).map((row, index) => <div className="bar-row" key={`${row.market}-${index}`}><span>{row.shortMarket}</span><div><i style={{ width: `${Math.max(18, (row.average / Math.max(high, 1)) * 100)}%` }} /></div><strong>{money.format(row.average)}</strong></div>)}
          </div></article>
          <aside className="panel insight"><p className="eyebrow">Lectura rápida</p><h3>{money.format(high - low)}</h3><p>de diferencia entre el precio promedio más alto y el más bajo del día.</p><div className="insight-rule" /><small>{highRow?.shortMarket ?? '—'} registra el valor superior; {lowRow?.shortMarket ?? '—'}, el inferior.</small></aside>
        </div>

        <article className="panel table-panel" id="datos">
          <div className="panel-title"><div><p>Detalle oficial</p><h3>Observaciones recientes</h3></div><span>{filteredRows.length} registros</span></div>
          <div className="table-scroll"><table><thead><tr><th>Mercado</th><th>Variedad</th><th>Origen</th><th>Volumen</th><th>Mínimo</th><th>Máximo</th><th>Promedio</th></tr></thead><tbody>{filteredRows.map((row, index) => <tr key={`${row.market}-${row.variety}-${index}`}><td><strong>{row.shortMarket}</strong><small>{row.quality}</small></td><td>{row.variety}</td><td>{row.origin}</td><td>{number.format(row.volume)}</td><td>{money.format(row.minimum)}</td><td>{money.format(row.maximum)}</td><td className="price-cell">{money.format(row.average)}</td></tr>)}</tbody></table></div>
          <footer><span>Fuente: ODEPA · Precios mayoristas de frutas y hortalizas 2026</span><span>Los valores mantienen su unidad de comercialización original.</span></footer>
        </article>
      </section>
    </main>
  );
}
