import { LineChart, Table2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { api } from '../services/api.js';

const WIDTH = 320;
const HEIGHT = 150;
const PAD = { top: 14, right: 14, bottom: 24, left: 34 };

const CHARTS = [
  {
    key: 'bp',
    title: 'Blood pressure',
    unit: 'mmHg',
    series: [
      { key: 'systolic', label: 'Systolic', color: 'var(--vt-series-1)', get: (r) => r.bloodPressure?.systolic },
      { key: 'diastolic', label: 'Diastolic', color: 'var(--vt-series-2)', get: (r) => r.bloodPressure?.diastolic },
    ],
    band: { from: 60, to: 120, label: 'Normal 60–120' },
    floor: 40,
  },
  {
    key: 'pulse',
    title: 'Pulse rate',
    unit: 'bpm',
    series: [{ key: 'pulseRate', label: 'Pulse', color: 'var(--vt-series-1)', get: (r) => r.pulseRate }],
    band: { from: 60, to: 100, label: 'Normal 60–100' },
    floor: 40,
  },
  {
    key: 'spo2',
    title: 'SpO₂',
    unit: '%',
    series: [{ key: 'spo2', label: 'SpO₂', color: 'var(--vt-series-1)', get: (r) => r.spo2 }],
    band: { from: 95, to: 100, label: 'Normal ≥95%' },
    floor: 85,
    ceiling: 100,
  },
];

const dateFormat = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short' });
const dateTimeFormat = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

function niceStep(range) {
  const raw = range / 4;
  const magnitude = 10 ** Math.floor(Math.log10(raw || 1));
  const normalized = raw / magnitude;
  return (normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10) * magnitude;
}

function TrendPanel({ config, readings }) {
  const [hover, setHover] = useState(null);
  const points = useMemo(() => readings.filter((reading) => config.series.some((series) => Number.isFinite(series.get(reading)))), [readings, config]);

  const scale = useMemo(() => {
    const values = points.flatMap((reading) => config.series.map((series) => series.get(reading)).filter(Number.isFinite));
    let min = Math.min(config.floor, config.band.from, ...values);
    let max = Math.max(config.band.to, ...values);
    if (config.ceiling) max = Math.min(Math.max(max, config.ceiling), config.ceiling);
    const step = niceStep(max - min);
    min = Math.floor(min / step) * step;
    max = Math.ceil(max / step) * step;
    const ticks = [];
    for (let value = min; value <= max + 1e-9; value += step) ticks.push(Math.round(value * 10) / 10);
    const innerW = WIDTH - PAD.left - PAD.right;
    const innerH = HEIGHT - PAD.top - PAD.bottom;
    const x = (index) => PAD.left + (points.length === 1 ? innerW / 2 : (index / (points.length - 1)) * innerW);
    const y = (value) => PAD.top + innerH - ((value - min) / (max - min || 1)) * innerH;
    return { min, max, ticks, x, y, innerW, innerH };
  }, [points, config]);

  const latest = points.at(-1);
  const latestText = latest
    ? config.series.map((series) => series.get(latest)).filter(Number.isFinite).join('/')
    : '—';

  const handleMove = (event) => {
    if (!points.length) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const svgX = ((event.clientX - rect.left) / rect.width) * WIDTH;
    let nearest = 0;
    points.forEach((_point, index) => {
      if (Math.abs(scale.x(index) - svgX) < Math.abs(scale.x(nearest) - svgX)) nearest = index;
    });
    setHover(nearest);
  };

  const hovered = hover !== null ? points[hover] : null;
  const tooltipLeft = hover !== null ? `${(scale.x(hover) / WIDTH) * 100}%` : 0;

  return (
    <article className="vitals-trend-card">
      <header>
        <span>{config.title}</span>
        <b>{latestText}<small> {config.unit}</small></b>
      </header>
      {config.series.length > 1 && (
        <div className="vitals-trend-legend">
          {config.series.map((series) => <span key={series.key}><i style={{ background: series.color }} />{series.label}</span>)}
        </div>
      )}
      {points.length === 0 ? (
        <div className="vitals-trend-empty">No {config.title.toLowerCase()} readings yet</div>
      ) : (
        <div className="vitals-trend-plot">
          <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label={`${config.title} trend, ${points.length} readings`} onMouseMove={handleMove} onMouseLeave={() => setHover(null)}>
            <rect className="vt-band" x={PAD.left} width={scale.innerW} y={scale.y(Math.min(config.band.to, scale.max))} height={Math.max(0, scale.y(Math.max(config.band.from, scale.min)) - scale.y(Math.min(config.band.to, scale.max)))} />
            {scale.ticks.map((tick) => (
              <g key={tick}>
                <line className="vt-grid" x1={PAD.left} x2={WIDTH - PAD.right} y1={scale.y(tick)} y2={scale.y(tick)} />
                <text className="vt-axis" x={PAD.left - 6} y={scale.y(tick)} dy="0.32em" textAnchor="end">{tick}</text>
              </g>
            ))}
            {points.map((point, index) => {
              const show = points.length <= 6 || index === 0 || index === points.length - 1;
              return show ? <text key={`x-${index}`} className="vt-axis" x={scale.x(index)} y={HEIGHT - 6} textAnchor={points.length === 1 ? 'middle' : index === 0 ? 'start' : index === points.length - 1 ? 'end' : 'middle'}>{dateFormat.format(new Date(point.recordedAt))}</text> : null;
            })}
            {hover !== null && <line className="vt-crosshair" x1={scale.x(hover)} x2={scale.x(hover)} y1={PAD.top} y2={PAD.top + scale.innerH} />}
            {config.series.map((series) => {
              const segment = points.map((point, index) => [index, series.get(point)]).filter(([, value]) => Number.isFinite(value));
              const path = segment.map(([index, value], i) => `${i ? 'L' : 'M'}${scale.x(index)},${scale.y(value)}`).join(' ');
              return (
                <g key={series.key}>
                  {segment.length > 1 && <path d={path} fill="none" stroke={series.color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />}
                  {segment.map(([index, value]) => (
                    <circle key={index} className="vt-dot" cx={scale.x(index)} cy={scale.y(value)} r={hover === index ? 5 : 4} fill={series.color} />
                  ))}
                </g>
              );
            })}
          </svg>
          {hovered && (
            <div className="vitals-trend-tooltip" style={{ left: tooltipLeft }} role="status">
              <small>{dateTimeFormat.format(new Date(hovered.recordedAt))}</small>
              {config.series.map((series) => (
                <span key={series.key}><i style={{ background: series.color }} />{series.label} <b>{Number.isFinite(series.get(hovered)) ? series.get(hovered) : '—'}</b> {config.unit}</span>
              ))}
            </div>
          )}
        </div>
      )}
      <footer>{config.band.label}</footer>
    </article>
  );
}

export default function VitalsTrendChart({ patient }) {
  const [readings, setReadings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showTable, setShowTable] = useState(false);
  const patientId = patient?.patientId;
  const lastRecordedAt = patient?.vitals?.recordedAt;

  useEffect(() => {
    if (!patientId) return undefined;
    let cancelled = false;
    setLoading(true);
    setError('');
    api.get(`/patients/${encodeURIComponent(patientId)}/vitals/history`)
      .then(({ data }) => { if (!cancelled) setReadings(data.readings || []); })
      .catch((requestError) => { if (!cancelled) setError(requestError.response?.data?.error?.message || 'Could not load vitals history.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [patientId, lastRecordedAt]);

  return (
    <section className="panel record-history vitals-trend-panel">
      <div className="panel-heading">
        <div>
          <h2><LineChart size={16} /> Vitals trend</h2>
          <p>Historical blood pressure, pulse and SpO₂ readings. Shaded bands show normal adult ranges.</p>
        </div>
        {readings.length > 0 && (
          <button type="button" className="text-button" onClick={() => setShowTable((value) => !value)} aria-pressed={showTable}>
            <Table2 size={14} /> {showTable ? 'Show charts' : 'Show table'}
          </button>
        )}
      </div>
      {loading ? (
        <div className="admin-loading"><span className="loading-spinner" /> Loading vitals history…</div>
      ) : error ? (
        <div className="admin-alert error" role="alert">{error}</div>
      ) : readings.length === 0 ? (
        <div className="admin-empty"><LineChart size={22} /><b>No vitals recorded yet</b><span>Trends appear once vitals are recorded for this patient.</span></div>
      ) : showTable ? (
        <div className="table-scroll">
          <table className="staff-table vitals-trend-table">
            <thead><tr><th>Recorded</th><th>BP (mmHg)</th><th>Pulse (bpm)</th><th>SpO₂ (%)</th></tr></thead>
            <tbody>
              {readings.slice().reverse().map((reading, index) => (
                <tr key={`${reading.recordedAt}-${index}`}>
                  <td>{dateTimeFormat.format(new Date(reading.recordedAt))}</td>
                  <td>{reading.bloodPressure?.systolic && reading.bloodPressure?.diastolic ? `${reading.bloodPressure.systolic}/${reading.bloodPressure.diastolic}` : '—'}</td>
                  <td>{reading.pulseRate ?? '—'}</td>
                  <td>{reading.spo2 ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="vitals-trend-grid">
          {CHARTS.map((config) => <TrendPanel key={config.key} config={config} readings={readings} />)}
        </div>
      )}
    </section>
  );
}
