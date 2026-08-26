'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

type CompactRow = [number, number, number, number, number, number, string, string, string, number];
type Snapshot = {
  meta: { source_url: string; fetched_at: string; max_data_date: string; min_data_date: string; source_rows: number; aggregated_rows: number; file_sha256: string };
  dates: string[]; products: string[]; markets: string[]; subsectors: string[]; units: string[];
  product_subsectors: number[]; rows: CompactRow[];
};
type DailyPoint = { date: string; volume: number; minimum: number; maximum: number; average: number; observations: number };
type MarketPoint = { market: string; volume: number; minimum: number; maximum: number; average: number; observations: number };

const money = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 });
const number = new Intl.NumberFormat('es-CL');
const shortDate = new Intl.DateTimeFormat('es-CL', { day: '2-digit', month: 'short', timeZone: 'UTC' });
const longDate = new Intl.DateTimeFormat('es-CL', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'America/Santiago' });
const longDateTime = new Intl.DateTimeFormat('es-CL', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'America/Santiago' });

function parseDate(value: string) { return new Date(`${value}T12:00:00Z`); }

function PriceChart({ points }: { points: DailyPoint[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !points.length) return;
    const draw = () => {
      const context = canvas.getContext('2d');
      if (!context) return;
      const ratio = window.devicePixelRatio || 1;
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      canvas.width = width * ratio;
      canvas.height = height * ratio;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      context.clearRect(0, 0, width, height);
      const margin = { top: 20, right: 18, bottom: 42, left: 62 };
      const chartWidth = width - margin.left - margin.right;
      const chartHeight = height - margin.top - margin.bottom;
      const rawMin = Math.min(...points.map((point) => point.minimum));
      const rawMax = Math.max(...points.map((point) => point.maximum));
      const padding = Math.max((rawMax - rawMin) * 0.12, rawMax * 0.03, 1);
      const yMin = Math.max(0, rawMin - padding);
      const yMax = rawMax + padding;
      const x = (index: number) => margin.left + (points.length === 1 ? chartWidth / 2 : index * chartWidth / (points.length - 1));
      const y = (value: number) => margin.top + (yMax - value) * chartHeight / (yMax - yMin || 1);

      context.font = '11px Inter, system-ui, sans-serif';
      context.fillStyle = '#7b8781';
      context.strokeStyle = '#e5e4dc';
      context.lineWidth = 1;
      for (let tick = 0; tick <= 4; tick += 1) {
        const value = yMin + (yMax - yMin) * tick / 4;
        const yy = y(value);
        context.beginPath(); context.moveTo(margin.left, yy); context.lineTo(width - margin.right, yy); context.stroke();
        context.textAlign = 'right'; context.fillText(money.format(value), margin.left - 10, yy + 4);
      }

      const labelCount = Math.min(5, points.length);
      for (let tick = 0; tick < labelCount; tick += 1) {
        const index = Math.round(tick * (points.length - 1) / Math.max(labelCount - 1, 1));
        context.textAlign = tick === 0 ? 'left' : tick === labelCount - 1 ? 'right' : 'center';
        context.fillText(shortDate.format(parseDate(points[index].date)), x(index), height - 14);
      }

      context.beginPath();
      points.forEach((point, index) => index === 0 ? context.moveTo(x(index), y(point.maximum)) : context.lineTo(x(index), y(point.maximum)));
      for (let index = points.length - 1; index >= 0; index -= 1) context.lineTo(x(index), y(points[index].minimum));
      context.closePath(); context.fillStyle = 'rgba(34,97,77,.11)'; context.fill();

      const line = (field: 'minimum' | 'average' | 'maximum', color: string, widthValue: number, dash: number[] = []) => {
        context.beginPath(); context.strokeStyle = color; context.lineWidth = widthValue; context.setLineDash(dash);
        points.forEach((point, index) => index === 0 ? context.moveTo(x(index), y(point[field])) : context.lineTo(x(index), y(point[field])));
        context.stroke(); context.setLineDash([]);
      };
      line('minimum', '#b97954', 1.5, [5, 4]);
      line('maximum', '#7d8e66', 1.5, [5, 4]);
      line('average', '#22614d', 3);
    };
    draw();
    const observer = new ResizeObserver(draw);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [points]);

  if (!points.length) return <div className="empty-chart">No hay observaciones para la combinación seleccionada.</div>;
  return <canvas ref={canvasRef} className="price-chart" role="img" aria-label="Gráfico histórico de precio mínimo, promedio y máximo" />;
}

export default function Home() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [subsector, setSubsector] = useState('Todos los tipos');
  const [product, setProduct] = useState('Papa');
  const [market, setMarket] = useState('Todos los mercados');
  const [unit, setUnit] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  useEffect(() => {
    fetch('/data/odepa-2026.json')
      .then(async (response) => { if (!response.ok) throw new Error('No se pudo cargar el historial'); return await response.json() as Snapshot; })
      .then((data) => {
        setSnapshot(data);
        setFrom(data.dates[Math.max(0, data.dates.length - 65)]);
        setTo(data.meta.max_data_date);
      })
      .catch(() => setLoadError(true));
  }, []);

  const productOptions = useMemo(() => {
    if (!snapshot) return [];
    if (subsector === 'Todos los tipos') return snapshot.products;
    const subsectorIndex = snapshot.subsectors.indexOf(subsector);
    return snapshot.products.filter((_, index) => snapshot.product_subsectors[index] === subsectorIndex);
  }, [snapshot, subsector]);

  const productIndex = snapshot?.products.indexOf(product) ?? -1;
  const unitOptions = useMemo(() => {
    if (!snapshot || productIndex < 0) return [];
    const counts = new Map<number, number>();
    snapshot.rows.forEach((row) => { if (row[1] === productIndex) counts.set(row[4], (counts.get(row[4]) ?? 0) + row[9]); });
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([index]) => snapshot.units[index]);
  }, [snapshot, productIndex]);
  const effectiveUnit = unitOptions.includes(unit) ? unit : (unitOptions[0] ?? '');

  const filteredRows = useMemo(() => {
    if (!snapshot || productIndex < 0 || !effectiveUnit || !from || !to) return [];
    const marketIndex = market === 'Todos los mercados' ? -1 : snapshot.markets.indexOf(market);
    const unitIndex = snapshot.units.indexOf(effectiveUnit);
    return snapshot.rows.filter((row) => row[1] === productIndex && row[4] === unitIndex && (marketIndex < 0 || row[2] === marketIndex) && snapshot.dates[row[0]] >= from && snapshot.dates[row[0]] <= to);
  }, [snapshot, productIndex, effectiveUnit, market, from, to]);

  const dailyPoints = useMemo(() => {
    if (!snapshot) return [];
    const groups = new Map<number, { volume: number; minimum: number; maximum: number; weighted: number; observations: number }>();
    filteredRows.forEach((row) => {
      const current = groups.get(row[0]) ?? { volume: 0, minimum: Infinity, maximum: -Infinity, weighted: 0, observations: 0 };
      current.volume += row[5]; current.minimum = Math.min(current.minimum, Number(row[6])); current.maximum = Math.max(current.maximum, Number(row[7])); current.weighted += Number(row[8]) * row[5]; current.observations += row[9]; groups.set(row[0], current);
    });
    return [...groups.entries()].sort((a, b) => a[0] - b[0]).map(([dateIndex, group]) => ({ date: snapshot.dates[dateIndex], volume: group.volume, minimum: group.minimum, maximum: group.maximum, average: group.weighted / group.volume, observations: group.observations }));
  }, [snapshot, filteredRows]);

  const marketPoints = useMemo(() => {
    if (!snapshot) return [];
    const groups = new Map<number, { volume: number; minimum: number; maximum: number; weighted: number; observations: number }>();
    filteredRows.forEach((row) => {
      const current = groups.get(row[2]) ?? { volume: 0, minimum: Infinity, maximum: -Infinity, weighted: 0, observations: 0 };
      current.volume += row[5]; current.minimum = Math.min(current.minimum, Number(row[6])); current.maximum = Math.max(current.maximum, Number(row[7])); current.weighted += Number(row[8]) * row[5]; current.observations += row[9]; groups.set(row[2], current);
    });
    return [...groups.entries()].map(([marketIndex, group]) => ({ market: snapshot.markets[marketIndex], volume: group.volume, minimum: group.minimum, maximum: group.maximum, average: group.weighted / group.volume, observations: group.observations })).sort((a, b) => b.average - a.average) as MarketPoint[];
  }, [snapshot, filteredRows]);

  const metrics = useMemo(() => {
    if (!dailyPoints.length) return { average: 0, minimum: 0, maximum: 0, volume: 0 };
    const volume = dailyPoints.reduce((sum, point) => sum + point.volume, 0);
    return { average: dailyPoints.reduce((sum, point) => sum + point.average * point.volume, 0) / volume, minimum: Math.min(...dailyPoints.map((point) => point.minimum)), maximum: Math.max(...dailyPoints.map((point) => point.maximum)), volume };
  }, [dailyPoints]);

  const fetchedAt = snapshot ? longDateTime.format(new Date(snapshot.meta.fetched_at)) : '—';
  const maxDataDate = snapshot ? longDate.format(parseDate(snapshot.meta.max_data_date)) : '—';

  if (loadError) return <main className="state-page"><h1>No pudimos cargar el historial.</h1><p>La fuente quedó temporalmente indisponible. Intenta nuevamente.</p></main>;
  if (!snapshot) return <main className="state-page"><span className="loader" /><h1>Cargando datos ODEPA…</h1></main>;

  return (
    <main>
      <header className="topbar">
        <a className="brand" href="#inicio" aria-label="Campo Claro, inicio"><span className="brand-mark" aria-hidden="true"><i /></span><span>Campo Claro</span></a>
        <nav aria-label="Navegación principal"><a className="active" href="#evolucion">Evolución</a><a href="#mercados">Mercados</a><a href="#fuente">Fuente</a></nav>
        <span className="official-badge"><i /> Fuente oficial ODEPA</span>
      </header>

      <section className="hero" id="inicio">
        <div><p className="eyebrow">Inteligencia mayorista · Chile</p><h1>Precios del campo,<br /><em>sin ruido.</em></h1><p className="hero-copy">Consulta la evolución de los precios de frutas y hortalizas en los principales mercados de Chile.</p></div>
        <div className="freshness-card"><span className="pulse" /><div><strong>Datos actualizados al {fetchedAt}</strong><small>Último registro ODEPA: {maxDataDate}</small></div><span className="freshness-time">CLT</span></div>
      </section>

      <section className="dashboard" id="evolucion">
        <div className="filters" aria-label="Filtros del historial">
          <label>Tipo de producto<select value={subsector} onChange={(event) => { const next = event.target.value; setSubsector(next); const index = snapshot.subsectors.indexOf(next); if (next !== 'Todos los tipos' && snapshot.product_subsectors[productIndex] !== index) setProduct(snapshot.products.find((_, productPosition) => snapshot.product_subsectors[productPosition] === index) ?? 'Papa'); setUnit(''); }}><option>Todos los tipos</option>{snapshot.subsectors.map((item) => <option key={item}>{item}</option>)}</select></label>
          <label>Producto<select value={product} onChange={(event) => { setProduct(event.target.value); setUnit(''); }}>
            {productOptions.map((item) => <option key={item}>{item}</option>)}
          </select><small>{productOptions.length} productos disponibles</small></label>
          <label>Mercado<select value={market} onChange={(event) => setMarket(event.target.value)}><option>Todos los mercados</option>{snapshot.markets.map((item) => <option key={item}>{item}</option>)}</select></label>
          <label>Unidad original<select value={effectiveUnit} onChange={(event) => setUnit(event.target.value)}>{unitOptions.map((item) => <option key={item}>{item}</option>)}</select></label>
          <div className="date-filter"><span>Rango de fechas</span><div><label><small>Desde</small><input type="date" min={snapshot.meta.min_data_date} max={to} value={from} onChange={(event) => setFrom(event.target.value)} /></label><label><small>Hasta</small><input type="date" min={from} max={snapshot.meta.max_data_date} value={to} onChange={(event) => setTo(event.target.value)} /></label></div></div>
        </div>

        <div className="section-heading"><div><span className="produce-dot" /><h2>{product}</h2><span className="unit-pill">{effectiveUnit}</span></div><p>{market} · {dailyPoints.length} días con datos</p></div>
        <div className="metrics">
          <article className="metric featured"><span>Precio promedio ponderado</span><strong>{money.format(metrics.average)}</strong><small>Para el periodo y filtros seleccionados</small></article>
          <article className="metric"><span>Mínimo observado</span><strong>{money.format(metrics.minimum)}</strong><small>Unidad original</small></article>
          <article className="metric"><span>Máximo observado</span><strong>{money.format(metrics.maximum)}</strong><small>Unidad original</small></article>
          <article className="metric"><span>Volumen informado</span><strong>{number.format(metrics.volume)}</strong><small>Unidades de comercialización</small></article>
        </div>

        <article className="panel chart-panel">
          <div className="panel-title"><div><p>Evolución histórica</p><h3>Precio mínimo, promedio y máximo</h3></div><div className="legend"><span className="legend-min">Mínimo</span><span className="legend-avg">Promedio</span><span className="legend-max">Máximo</span></div></div>
          <PriceChart points={dailyPoints} />
          <p className="chart-note">El promedio se pondera por el volumen informado. La banda representa el rango mínimo–máximo. Nunca se mezclan unidades de comercialización distintas.</p>
        </article>

        <article className="panel table-panel" id="mercados">
          <div className="panel-title"><div><p>Comparación</p><h3>Resumen por mercado</h3></div><span>{marketPoints.length} mercados</span></div>
          <div className="table-scroll"><table><thead><tr><th>Mercado</th><th>Observaciones</th><th>Volumen</th><th>Mínimo</th><th>Máximo</th><th>Promedio ponderado</th></tr></thead><tbody>{marketPoints.map((row) => <tr key={row.market}><td><strong>{row.market}</strong></td><td>{number.format(row.observations)}</td><td>{number.format(row.volume)}</td><td>{money.format(row.minimum)}</td><td>{money.format(row.maximum)}</td><td className="price-cell">{money.format(row.average)}</td></tr>)}</tbody></table></div>
        </article>

        <aside className="source-card" id="fuente"><div><p className="eyebrow">Trazabilidad de datos</p><h3>{number.format(snapshot.meta.source_rows)} filas originales verificadas</h3><p>La interfaz usa una instantánea generada directamente desde el CSV oficial. Contiene {snapshot.products.length} productos, {snapshot.markets.length} mercados y {snapshot.units.length} unidades. El histórico original permanece sin modificaciones.</p></div><a href={snapshot.meta.source_url} target="_blank" rel="noreferrer">Abrir CSV oficial ↗</a></aside>
      </section>
    </main>
  );
}
